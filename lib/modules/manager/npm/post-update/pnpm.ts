import { isNonEmptyString, isNumber, isNumericString } from '@sindresorhus/is';
import { quote } from 'shlex';
import upath from 'upath';
import { GlobalConfig } from '../../../../config/global.ts';
import { TEMPORARY_ERROR } from '../../../../constants/error-messages.ts';
import { logger } from '../../../../logger/index.ts';
import { coerceArray } from '../../../../util/array.ts';
import { getElapsedMs } from '../../../../util/date.ts';
import { exec, getToolSettingsOptions } from '../../../../util/exec/index.ts';
import type {
  ExecOptions,
  ExtraEnv,
  ToolConstraint,
} from '../../../../util/exec/types.ts';
import {
  deleteLocalFile,
  ensureCacheDir,
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../../util/fs/index.ts';
import {
  calculatePackageManagerMinimumReleaseAgeMs,
  getMinimumReleaseAgeExemption,
  isPackageManagerSyncEnabled,
} from '../../../../util/minimum-release-age.ts';
import { coerceNumber } from '../../../../util/number.ts';
import { regEx } from '../../../../util/regex.ts';
import { uniqueStrings } from '../../../../util/string.ts';
import { parseSingleYaml } from '../../../../util/yaml.ts';
import { NpmDatasource } from '../../../datasource/npm/index.ts';
import { intersectsWith, isSubsetOf } from '../../../versioning/common.ts';
import { api as npmVersioning } from '../../../versioning/npm/index.ts';
import type { PostUpdateConfig, Upgrade } from '../../types.ts';
import {
  artifactErrorMessageFromExecError,
  resolveToolConstraint,
} from '../../util.ts';
import { PNPM_CACHE_DIR, PNPM_STORE_DIR } from '../constants.ts';
import {
  getPnpmMinimumReleaseAgeMinutes,
  isPnpmMinimumReleaseAgeExcluded,
  parsePnpmMinimumReleaseAgeExclude,
  readPnpmWorkspaceMinimumReleaseAge,
} from '../extract/pnpm-minimum-release-age.ts';
import type {
  PnpmMinimumReleaseAgeExclude,
  PnpmWorkspaceFile,
} from '../extract/types.ts';
import { minimumReleaseAgePnpmRange } from '../minimum-release-age.ts';
import { getNodeToolConstraint } from './node-version.ts';
import type { GenerateLockFileResult, PnpmLockFile } from './types.ts';
import {
  getNodeOptions,
  getPackageManagerVersion,
  lazyLoadPackageJson,
} from './utils.ts';

function getPnpmConstraintFromUpgrades(upgrades: Upgrade[]): string | null {
  for (const upgrade of upgrades) {
    if (upgrade.depName === 'pnpm' && upgrade.newVersion) {
      return upgrade.newVersion;
    }
  }
  return null;
}

const minuteMs = 60 * 1000;

// pnpm supports exact versions in `minimumReleaseAgeExclude` since v10.19.0
// https://github.com/pnpm/pnpm/releases/tag/v10.19.0
const pnpmExactVersionExcludeRange = '>=10.19.0';

interface MinimumReleaseAgeArgs {
  args: string;
  minutes: number;
  notice?: string;
}

/**
 * Whether the pnpm version supports exact versions in `minimumReleaseAgeExclude`.
 *
 * An unknown pnpm version counts as the latest pnpm.
 */
function supportsExactVersionExclude(
  pnpmConstraint: string | null | undefined,
): boolean {
  const isKnownVersion =
    isNonEmptyString(pnpmConstraint) && npmVersioning.isValid(pnpmConstraint);
  return (
    !isKnownVersion ||
    isSubsetOf(npmVersioning, pnpmConstraint, pnpmExactVersionExcludeRange)
  );
}

/**
 * The name of the npm package whose `newVersion` pnpm installs for `upgrade`.
 */
function getInstalledPackageName(upgrade: Upgrade): string | undefined {
  // a replacement installs `newName`, and the depName of a pnpm override with
  // a selector is the override key
  return upgrade.newName ?? upgrade.packageName ?? upgrade.depName;
}

/**
 * Whether the release of `upgrade` is at least as old as the minimum release age of `pnpmMinutes` which pnpm configures itself, where a release without a timestamp only passes `0`.
 */
function isOldEnoughForPnpm(upgrade: Upgrade, pnpmMinutes: number): boolean {
  if (!pnpmMinutes) {
    return true;
  }
  return (
    !!upgrade.releaseTimestamp &&
    getElapsedMs(upgrade.releaseTimestamp) >= pnpmMinutes * minuteMs
  );
}

/**
 * The `minimumReleaseAgeExclude` entries which exclude the updated versions of npm packages from the minimum release age which Renovate passes to pnpm, as Renovate already applied its own minimum release age to them, for releases at least as old as the minimum release age of `pnpmMinutes` which pnpm configures itself.
 *
 * The `--config.minimum-release-age-exclude` flags replace the `pnpm-workspace.yaml` list, so the entries start with the workspace ones.
 * pnpm before v11.23.0 reads a single flag as a string, one character at a time, so a single entry is repeated.
 */
function getMinimumReleaseAgeExcludes(
  upgrades: Upgrade[],
  workspaceExclude: string[] | undefined,
  exclude: PnpmMinimumReleaseAgeExclude,
  pnpmMinutes: number,
): string[] {
  const updated: string[] = [];
  for (const upgrade of upgrades) {
    const packageName = getInstalledPackageName(upgrade);
    if (
      upgrade.datasource === NpmDatasource.id &&
      packageName &&
      upgrade.newVersion &&
      !isPnpmMinimumReleaseAgeExcluded(
        exclude,
        packageName,
        upgrade.newVersion,
      ) &&
      isOldEnoughForPnpm(upgrade, pnpmMinutes)
    ) {
      updated.push(`${packageName}@${upgrade.newVersion}`);
    }
  }
  if (!updated.length) {
    return [];
  }
  const entries = [...coerceArray(workspaceExclude), ...updated].filter(
    uniqueStrings,
  );
  return entries.length === 1 ? [entries[0], entries[0]] : entries;
}

/**
 * Whether pnpm applies the minimum release age to the version which Renovate proposes for `upgrade`, as it is an npm package which `minimumReleaseAgeExclude` does not exclude.
 */
function isCheckedByPnpm(
  upgrade: Upgrade,
  exclude: PnpmMinimumReleaseAgeExclude,
): boolean {
  const packageName = getInstalledPackageName(upgrade);
  return (
    upgrade.datasource === NpmDatasource.id &&
    !(
      packageName &&
      isPnpmMinimumReleaseAgeExcluded(exclude, packageName, upgrade.newVersion)
    )
  );
}

/**
 * The `--config.minimum-release-age` flag, in minutes, which passes the larger of Renovate's minimum release age and the pnpm value to pnpm.
 *
 * Renovate's value comes from `calculatePackageManagerMinimumReleaseAgeMs`.
 * The pnpm value comes from the `pnpm-workspace.yaml`, the `.npmrc` before pnpm v11, or the pnpm v11 default.
 *
 * If the pnpm version supports exact versions in `minimumReleaseAgeExclude`, `--config.minimum-release-age-exclude` flags exclude the updated versions whose release is at least as old as the pnpm value.
 * Otherwise the flag is lowered to the smaller own minimum release age of exempted updates, but not below the pnpm value, with a notice.
 *
 * pnpm reads `--config.minimum-release-age` since v10.16.0, and the flag takes precedence over the `pnpm-workspace.yaml`.
 */
async function getMinimumReleaseAgeArgs(
  lockFileName: string,
  config: PostUpdateConfig,
  upgrades: Upgrade[],
  npmrcContent: string | null,
  pnpmConstraint: string | null | undefined,
): Promise<MinimumReleaseAgeArgs | null> {
  // the pnpm value is added below, as it depends on the pnpm version
  const minimumReleaseAgeMs = calculatePackageManagerMinimumReleaseAgeMs({
    config,
    manager: 'npm',
    packageFile: upath.join(upath.dirname(lockFileName), 'package.json'),
    upgrades,
  });
  if (!minimumReleaseAgeMs) {
    return null;
  }
  const workspace = await readPnpmWorkspaceMinimumReleaseAge(lockFileName);
  const pnpmMinutes = getPnpmMinimumReleaseAgeMinutes(
    workspace,
    npmrcContent,
    pnpmConstraint,
    true,
  );
  const configMinutes = pnpmMinutes ?? 0;
  const minutes = Math.max(
    Math.ceil(minimumReleaseAgeMs / minuteMs),
    configMinutes,
  );
  logger.debug(
    { minimumReleaseAgeMs, pnpmMinimumReleaseAge: pnpmMinutes },
    `Passing a minimum release age of ${minutes} minutes to pnpm`,
  );
  const result: MinimumReleaseAgeArgs = {
    args: `--config.minimum-release-age=${minutes}`,
    minutes,
  };

  // lock file maintenance has no own updates which pnpm may reject
  if (upgrades.some((upgrade) => upgrade.isLockFileMaintenance)) {
    return result;
  }
  const exclude = parsePnpmMinimumReleaseAgeExclude(
    workspace.minimumReleaseAgeExclude,
  );
  if (supportsExactVersionExclude(pnpmConstraint)) {
    for (const entry of getMinimumReleaseAgeExcludes(
      upgrades,
      workspace.minimumReleaseAgeExclude,
      exclude,
      configMinutes,
    )) {
      result.args += ` ${quote(`--config.minimum-release-age-exclude=${entry}`)}`;
    }
    return result;
  }
  // pnpm ignores the minimum release age before v10.16.0
  if (
    !intersectsWith(npmVersioning, pnpmConstraint, minimumReleaseAgePnpmRange)
  ) {
    return result;
  }
  const exemption = getMinimumReleaseAgeExemption(
    upgrades.filter((upgrade) => isCheckedByPnpm(upgrade, exclude)),
    'npm',
    minutes * minuteMs,
  );
  // rounds down, so that pnpm accepts the releases of the exempted updates, but never below the pnpm value
  const loweredMinutes = Math.max(
    Math.floor(coerceNumber(exemption?.ageMs) / minuteMs),
    configMinutes,
  );
  if (!exemption || loweredMinutes >= minutes) {
    return result;
  }
  logger.debug(
    `Lowering the pnpm minimum release age from ${minutes} to ${loweredMinutes} minutes, as the minimumReleaseAge of ${exemption.depNames.join(', ')} is smaller and their release is younger or has no timestamp`,
  );
  const packages = exemption.depNames.map((name) => `\`${name}\``).join(', ');
  return {
    args: `--config.minimum-release-age=${loweredMinutes}`,
    minutes: loweredMinutes,
    notice: `pnpm checked a minimum release age of ${loweredMinutes} minutes instead of ${minutes} for this update, because the \`minimumReleaseAge\` of ${packages} is smaller. pnpm supports exact versions in \`minimumReleaseAgeExclude\` only since v10.19.0.`,
  };
}

const immatureVersionRegex = regEx(
  /Version (?<version>\S+) \(released [^)]*\) of (?<name>\S+) does not meet the minimumReleaseAge constraint/g,
);
const immatureListRegex = regEx(
  /not meet the minimumReleaseAge constraint:\r?\n(?<list>(?:[ \t]+\S+@\S+.*(?:\r?\n|$))+)/g,
);
const immatureListEntryRegex = regEx(/^[ \t]+(?<pkg>\S+@\S+)/gm);
const noMatureVersionRegex = regEx(
  /No matching version found for (?<pkg>\S+) published by /g,
);

/**
 * The packages which pnpm reports with `ERR_PNPM_NO_MATURE_MATCHING_VERSION`, as `name@version` or `name@range`.
 */
export function getImmaturePackages(output: string): string[] {
  if (!output.includes('ERR_PNPM_NO_MATURE_MATCHING_VERSION')) {
    return [];
  }
  const packages: string[] = [];
  for (const match of output.matchAll(immatureVersionRegex)) {
    packages.push(`${match.groups!.name}@${match.groups!.version}`);
  }
  for (const match of output.matchAll(immatureListRegex)) {
    for (const entry of match.groups!.list.matchAll(immatureListEntryRegex)) {
      packages.push(entry.groups!.pkg);
    }
  }
  for (const match of output.matchAll(noMatureVersionRegex)) {
    packages.push(match.groups!.pkg);
  }
  return packages.filter(uniqueStrings);
}

export async function generateLockFile(
  lockFileDir: string,
  env: NodeJS.ProcessEnv,
  config: PostUpdateConfig,
  upgrades: Upgrade[] = [],
  npmrcContent: string | null = null,
): Promise<GenerateLockFileResult> {
  const lockFileName = upath.join(lockFileDir, 'pnpm-lock.yaml');
  logger.debug(`Spawning pnpm install to create ${lockFileName}`);
  let lockFile: string | null = null;
  const commands: string[] = [];
  let minimumReleaseAgeNotice: string | undefined;
  let minimumReleaseAgeMinutes: number | undefined;
  const isSyncEnabled = isPackageManagerSyncEnabled({
    config,
    manager: 'npm',
    packageFile: upath.join(lockFileDir, 'package.json'),
    upgrades,
  });
  try {
    const lazyPgkJson = lazyLoadPackageJson(lockFileDir);
    const pnpmToolConstraint: ToolConstraint = {
      toolName: 'pnpm',
      constraint:
        getPnpmConstraintFromUpgrades(upgrades) ?? // if pnpm is being upgraded, it comes first
        (await resolveToolConstraint(
          config,
          'pnpm',
          async () =>
            getPackageManagerVersion('pnpm', await lazyPgkJson.getValue()) ?? // look in package.json > packageManager or engines
            (await getConstraintFromLockFile(lockFileName)), // use lockfileVersion to find pnpm version range
        )),
    };

    const pnpmConfigCacheDir = await ensureCacheDir(PNPM_CACHE_DIR);
    const pnpmConfigStoreDir = await ensureCacheDir(PNPM_STORE_DIR);
    const extraEnv: ExtraEnv = {
      // those arwe no longer working and it's unclear if they ever worked
      NPM_CONFIG_CACHE: env.NPM_CONFIG_CACHE,
      npm_config_store: env.npm_config_store,
      // these are used by pnpm v5 to v10. Maybe earlier versions too
      npm_config_cache_dir: pnpmConfigCacheDir,
      npm_config_store_dir: pnpmConfigStoreDir,
      // pnpm stops reading npm_config_* env vars since v11
      pnpm_config_cache_dir: pnpmConfigCacheDir,
      pnpm_config_store_dir: pnpmConfigStoreDir,
    };

    const { nodeMaxMemory } = getToolSettingsOptions(config.toolSettings);
    if (nodeMaxMemory) {
      extraEnv.NODE_OPTIONS = getNodeOptions(nodeMaxMemory);
    }

    const execOptions: ExecOptions = {
      cwdFile: lockFileName,
      extraEnv,
      docker: {},
      toolConstraints: [
        await getNodeToolConstraint(config, upgrades, lockFileDir, lazyPgkJson),
        pnpmToolConstraint,
      ],
    };
    /* v8 ignore next -- needs test */
    if (GlobalConfig.get('exposeAllEnv')) {
      extraEnv.NPM_AUTH = env.NPM_AUTH;
      extraEnv.NPM_EMAIL = env.NPM_EMAIL;
    }

    const pnpmWorkspaceFilePath = getSiblingFileName(
      lockFileName,
      'pnpm-workspace.yaml',
    );

    let args = '--lockfile-only';

    // If it's not a workspaces project/monorepo, but single project with unrelated other npm project in source tree (for example, a git submodule),
    // `--recursive` will install un-wanted project.
    // we should avoid this.
    if (await localPathExists(pnpmWorkspaceFilePath)) {
      const pnpmWorkspace = parseSingleYaml<PnpmWorkspaceFile>(
        (await readLocalFile(pnpmWorkspaceFilePath, 'utf8'))!,
      );
      if (pnpmWorkspace?.packages?.length) {
        logger.debug(
          `Found pnpm workspace with ${pnpmWorkspace.packages.length} package definitions`,
        );
        // we are in a monorepo, 'pnpm update' needs the '--recursive' flag contrary to 'pnpm install'
        args += ' --recursive';
      }
    }
    if (!GlobalConfig.get('allowScripts')) {
      // If the admin disallows scripts, then neither scripts nor the pnpmfile should be run
      args += ' --ignore-scripts';
      args += ' --ignore-pnpmfile';
    } else if (config.ignoreScripts) {
      // If the admin allows scripts then always allow the pnpmfile
      args += ' --ignore-scripts';
    }

    // without minimumReleaseAgePackageManagerSync, pnpm applies its own config
    const minimumReleaseAgeArgs = isSyncEnabled
      ? await getMinimumReleaseAgeArgs(
          lockFileName,
          config,
          upgrades,
          npmrcContent,
          pnpmToolConstraint.constraint,
        )
      : null;
    if (minimumReleaseAgeArgs) {
      args += ` ${minimumReleaseAgeArgs.args}`;
      minimumReleaseAgeMinutes = minimumReleaseAgeArgs.minutes;
      minimumReleaseAgeNotice = minimumReleaseAgeArgs.notice;
    }

    logger.trace({ args }, 'pnpm command options');

    const lockUpdates = upgrades.filter((upgrade) => upgrade.isLockfileUpdate);

    if (lockUpdates.length !== upgrades.length) {
      // This command updates the lock file based on package.json.
      // Pass `--no-frozen-lockfile` to ensure the lockfile is updated
      commands.push(`pnpm install ${args} --no-frozen-lockfile`);
    }

    // rangeStrategy = update-lockfile
    if (lockUpdates.length) {
      logger.debug('Performing lockfileUpdate (pnpm)');
      commands.push(
        `pnpm update --no-save ${lockUpdates
          // TODO: types (#22198)
          .map((update) => `${update.packageName!}@${update.newVersion!}`)
          .filter(uniqueStrings)
          .map(quote)
          .join(' ')} ${args}`,
      );
    }

    // postUpdateOptions
    if (config.postUpdateOptions?.includes('pnpmDedupe')) {
      commands.push(`pnpm dedupe ${args.replace(' --recursive', '')}`);
    }

    const isLockFileMaintenance = upgrades.some(
      (upgrade) => upgrade.isLockFileMaintenance,
    );
    if (isLockFileMaintenance) {
      logger.debug(
        `Removing ${lockFileName} first due to lock file maintenance upgrade`,
      );
      try {
        await deleteLocalFile(lockFileName);
      } catch (err) /* v8 ignore next -- TODO: add test #40625 */ {
        logger.debug(
          { err, lockFileName },
          'Error removing `pnpm-lock.yaml` for lock file maintenance',
        );
      }
    }

    await exec(commands, execOptions);
    lockFile = await readLocalFile(lockFileName, 'utf8');
  } catch (err) {
    // v8 ignore if -- TODO: add test #40625
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug(
      {
        commands,
        err,
        stdout: err.stdout,
        stderr: err.stderr,
        type: 'pnpm',
      },
      'lock file error',
    );
    const output = `${err.stdout ?? ''}\n${err.stderr ?? ''}`;
    const immaturePackages = isSyncEnabled ? getImmaturePackages(output) : [];
    if (immaturePackages.length) {
      const packages = immaturePackages.map((pkg) => `\`${pkg}\``).join(', ');
      return withNotice(
        {
          error: true,
          stderr: `pnpm found no version old enough for the minimum release age: ${packages}\n\n${artifactErrorMessageFromExecError(err, '')}`,
          stdout: err.stdout,
        },
        minimumReleaseAgeNotice,
      );
    }
    if (
      minimumReleaseAgeMinutes &&
      output.includes('ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION')
    ) {
      return withNotice(
        {
          error: true,
          stderr: `${getViolationHint(minimumReleaseAgeMinutes)}\n\n${artifactErrorMessageFromExecError(err, '')}`,
          stdout: err.stdout,
        },
        minimumReleaseAgeNotice,
      );
    }
    return withNotice(
      { error: true, stderr: err.stderr, stdout: err.stdout },
      minimumReleaseAgeNotice,
    );
  }
  return withNotice({ lockFile }, minimumReleaseAgeNotice);
}

// pnpm skips the verification of the lock file with `trustLockfile` since v11.3.0
// https://github.com/pnpm/pnpm/releases/tag/v11.3.0
function getViolationHint(minutes: number): string {
  return `The \`pnpm-lock.yaml\` contains packages younger than the minimum release age of ${minutes} minutes which Renovate passes to pnpm. Raise \`minimumReleaseAge\` in the \`pnpm-workspace.yaml\` to ${minutes}, or set \`trustLockfile: true\` there (pnpm v11.3.0 or later) to skip this check.`;
}

function withNotice(
  result: GenerateLockFileResult,
  minimumReleaseAgeNotice: string | undefined,
): GenerateLockFileResult {
  return minimumReleaseAgeNotice
    ? { ...result, minimumReleaseAgeNotice }
    : result;
}

export async function getConstraintFromLockFile(
  lockFileName: string,
): Promise<string | null> {
  let constraint: string | null = null;
  try {
    const lockfileContent = await readLocalFile(lockFileName, 'utf8');
    if (!lockfileContent) {
      logger.trace(`Empty pnpm lock file: ${lockFileName}`);
      return null;
    }
    // TODO: use schema (#9610)
    const pnpmLock = parseSingleYaml<PnpmLockFile>(lockfileContent);
    if (
      !isNumber(pnpmLock?.lockfileVersion) &&
      !isNumericString(pnpmLock?.lockfileVersion)
    ) {
      logger.trace(`Invalid pnpm lockfile version: ${lockFileName}`);
      return null;
    }
    // find matching lockfileVersion and use its constraints
    // if no match found use lockfileVersion 5
    // lockfileVersion 5 is the minimum version required to generate the pnpm-lock.yaml file
    const { lowerConstraint, upperConstraint } = lockToPnpmVersionMapping.find(
      (m) => m.lockfileVersion === pnpmLock.lockfileVersion,
    ) ?? {
      lockfileVersion: 5.0,
      lowerConstraint: '>=3',
      upperConstraint: '<3.5.0',
    };
    constraint = lowerConstraint;
    if (upperConstraint) {
      constraint += ` ${upperConstraint}`;
    }
  } catch (err) {
    logger.warn({ err }, 'Error getting pnpm constraints from lock file');
  }
  return constraint;
}

/**
 * pnpm lockfiles have corresponding version numbers called "lockfileVersion"
 * each lockfileVersion can only be generated by a certain pnpm version range
 * eg. lockfileVersion: 5.4 can only be generated by pnpm version >=7 && <8
 * official list can be found here : https://github.com/pnpm/spec/tree/master/lockfile
 * we use the mapping present below to find the compatible pnpm version range for a given lockfileVersion
 *
 * the various terms used in the mapping are explained below:
 * lowerConstraint : lowest pnpm version that can generate the lockfileVersion
 * upperConstraint : highest pnpm version that can generate the lockfileVersion
 * lowerBound      : highest pnpm version that is less than the lowerConstraint
 * upperBound      : lowest pnpm version that is greater than the upperConstraint
 *
 * To handle future lockfileVersions, we need to:
 * 1. add a upperBound and upperConstraint to the current latest lockfileVersion
 * 2. add an object for the new lockfileVersion with lowerBound and lowerConstraint
 *
 * lockfileVersion from v6 on are strings
 */
const lockToPnpmVersionMapping: LockToPnpmVersionMapping[] = [
  { lockfileVersion: '9.0', lowerConstraint: '>=9' },
  {
    lockfileVersion: '6.0',
    lowerConstraint: '>=7.24.2',
    upperConstraint: '<9',
  },
  {
    lockfileVersion: 5.4,
    lowerConstraint: '>=7',
    upperConstraint: '<8',
  },
  {
    lockfileVersion: 5.3,
    lowerConstraint: '>=6',
    upperConstraint: '<7',
  },
  {
    lockfileVersion: 5.2,
    lowerConstraint: '>=5.10.0',
    upperConstraint: '<6',
  },
  {
    lockfileVersion: 5.1,
    lowerConstraint: '>=3.5.0',
    upperConstraint: '<5.9.3',
  },
];

interface LockToPnpmVersionMapping {
  lockfileVersion: string | number;
  lowerConstraint: string;
  upperConstraint?: string;
}
