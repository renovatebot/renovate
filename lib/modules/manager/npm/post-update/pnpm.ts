import { isNonEmptyString, isNullOrUndefined } from '@sindresorhus/is';
import { quote } from 'shlex';
import upath from 'upath';
import { GlobalConfig } from '../../../../config/global.ts';
import { TEMPORARY_ERROR } from '../../../../constants/error-messages.ts';
import { logger } from '../../../../logger/index.ts';
import { coerceArray } from '../../../../util/array.ts';
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
  isReleaseOldEnough,
} from '../../../../util/minimum-release-age.ts';
import { coerceNumber } from '../../../../util/number.ts';
import { regEx } from '../../../../util/regex.ts';
import { uniqueStrings } from '../../../../util/string.ts';
import { parseSingleYaml } from '../../../../util/yaml.ts';
import { NpmDatasource } from '../../../datasource/npm/index.ts';
import { intersectsWith, isSubsetOf } from '../../../versioning/common.ts';
import { api as npmVersioning } from '../../../versioning/npm/index.ts';
import type { PostUpdateConfig, Upgrade } from '../../types.ts';
import { artifactErrorMessageFromExecError } from '../../util.ts';
import { MINUTE_MS, PNPM_CACHE_DIR, PNPM_STORE_DIR } from '../constants.ts';
import { parseNpmrcPnpmMinimumReleaseAge } from '../extract/npmrc.ts';
import { resolvePnpmConstraint } from '../extract/pnpm.ts';
import {
  getPnpmMinimumReleaseAgeMinutes,
  getPnpmWorkspaceMinimumReleaseAge,
  isPnpmMinimumReleaseAgeExcluded,
  parsePnpmMinimumReleaseAgeExclude,
} from '../extract/pnpm-minimum-release-age.ts';
import type {
  PnpmMinimumReleaseAgeExclude,
  PnpmWorkspaceFile,
} from '../extract/types.ts';
import { minimumReleaseAgePnpmRange } from '../minimum-release-age.ts';
import type { PnpmWorkspaceMinimumReleaseAge } from '../schema.ts';
import { getNodeToolConstraint } from './node-version.ts';
import type { GenerateLockFileResult } from './types.ts';
import {
  getInstalledPackageName,
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

// pnpm supports exact versions in `minimumReleaseAgeExclude` since v10.19.0
// https://github.com/pnpm/pnpm/releases/tag/v10.19.0
const pnpmExactVersionExcludeRange = '>=10.19.0';

interface MinimumReleaseAgeArgs {
  args: string;
  minutes: number;
  notice?: string;
}

/**
 * Whether the pnpm version supports exact versions in `minimumReleaseAgeExclude`, where an unknown version counts as the latest pnpm.
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
 * Returns the `minimumReleaseAgeExclude` entries of the `pnpm-workspace.yaml`, followed by the updated versions of npm packages whose release is at least as old as the minimum release age of `pnpmMinutes` which pnpm configures itself, with a single entry repeated, or none without such versions.
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
      isReleaseOldEnough(upgrade, pnpmMinutes * MINUTE_MS)
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
 * Whether `minimumReleaseAgeExclude` does not exclude the version which Renovate proposes for `upgrade`.
 */
function isNotExcludedByPnpm(
  upgrade: Upgrade,
  exclude: PnpmMinimumReleaseAgeExclude,
): boolean {
  const packageName = getInstalledPackageName(upgrade);
  return !(
    packageName &&
    isPnpmMinimumReleaseAgeExcluded(exclude, packageName, upgrade.newVersion)
  );
}

/**
 * Returns the `--config.minimum-release-age` flag in minutes for the larger of `minimumReleaseAgeMs` and the pnpm value, with `--config.minimum-release-age-exclude` flags for the updated versions if pnpm supports exact versions there, or else lowered to the smaller own minimum release age of exempted updates, but not below the pnpm value, with a notice.
 */
function getMinimumReleaseAgeArgs(
  minimumReleaseAgeMs: number,
  upgrades: Upgrade[],
  npmrcContent: string | null,
  pnpmConstraint: string | null | undefined,
  workspace: PnpmWorkspaceMinimumReleaseAge,
): MinimumReleaseAgeArgs | null {
  // the pnpm value is added below, as it depends on the pnpm version
  if (!minimumReleaseAgeMs) {
    return null;
  }
  const pnpmMinutes = getPnpmMinimumReleaseAgeMinutes(
    workspace,
    parseNpmrcPnpmMinimumReleaseAge(npmrcContent),
    pnpmConstraint,
    true,
  );
  const configMinutes = pnpmMinutes ?? 0;
  const minutes = Math.max(
    Math.ceil(minimumReleaseAgeMs / MINUTE_MS),
    configMinutes,
  );
  logger.debug(
    `Passing a minimum release age of ${minutes} minutes to pnpm, for a minimumReleaseAge of ${minimumReleaseAgeMs} ms and a pnpm minimumReleaseAge of ${pnpmMinutes ?? 'none'}`,
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
    upgrades.filter((upgrade) => isNotExcludedByPnpm(upgrade, exclude)),
    'npm',
    NpmDatasource.id,
    minutes * MINUTE_MS,
  );
  // rounds down, so that pnpm accepts the releases of the exempted updates, but never below the pnpm value
  const loweredMinutes = Math.max(
    Math.floor(coerceNumber(exemption?.ageMs) / MINUTE_MS),
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
  const syncAgeMs = calculatePackageManagerMinimumReleaseAgeMs({
    config,
    manager: 'npm',
    packageFile: upath.join(lockFileDir, 'package.json'),
    upgrades,
  });
  const isSyncEnabled = syncAgeMs !== null;
  try {
    const lazyPgkJson = lazyLoadPackageJson(lockFileDir);
    // if pnpm is being upgraded, it comes first
    let pnpmConstraint: string | null | undefined =
      getPnpmConstraintFromUpgrades(upgrades);
    if (isNullOrUndefined(pnpmConstraint)) {
      pnpmConstraint = await resolvePnpmConstraint(
        config,
        lockFileName,
        // look in package.json > packageManager or engines, then use the lockfileVersion
        async () =>
          getPackageManagerVersion('pnpm', await lazyPgkJson.getValue()),
      );
    }
    const pnpmToolConstraint: ToolConstraint = {
      toolName: 'pnpm',
      constraint: pnpmConstraint,
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
    let pnpmWorkspace: PnpmWorkspaceFile | null = null;
    if (await localPathExists(pnpmWorkspaceFilePath)) {
      pnpmWorkspace = parseSingleYaml<PnpmWorkspaceFile>(
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
      ? getMinimumReleaseAgeArgs(
          syncAgeMs,
          upgrades,
          npmrcContent,
          pnpmToolConstraint.constraint,
          getPnpmWorkspaceMinimumReleaseAge(pnpmWorkspace),
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
