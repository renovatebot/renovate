// TODO: types (#22198)
import { isNonEmptyString, isNumber, isString } from '@sindresorhus/is';
import { DateTime, Duration } from 'luxon';
import semver from 'semver';
import { quote } from 'shlex';
import upath from 'upath';
import { GlobalConfig } from '../../../../config/global.ts';
import {
  SYSTEM_INSUFFICIENT_DISK_SPACE,
  TEMPORARY_ERROR,
} from '../../../../constants/error-messages.ts';
import { logger } from '../../../../logger/index.ts';
import { exec, getToolSettingsOptions } from '../../../../util/exec/index.ts';
import type {
  ExecOptions,
  ExtraEnv,
  ToolConstraint,
} from '../../../../util/exec/types.ts';
import {
  deleteLocalFile,
  localPathExists,
  readLocalFile,
  renameLocalFile,
} from '../../../../util/fs/index.ts';
import { minimatch } from '../../../../util/minimatch.ts';
import {
  calculatePackageManagerMinimumReleaseAgeMs,
  getMinimumReleaseAgeExemption,
  isPackageManagerSyncEnabled,
} from '../../../../util/minimum-release-age.ts';
import { toMs } from '../../../../util/pretty-time.ts';
import { regEx } from '../../../../util/regex.ts';
import { Result } from '../../../../util/result.ts';
import { trimSlashes } from '../../../../util/url.ts';
import type { PostUpdateConfig, Upgrade } from '../../types.ts';
import { resolveToolConstraint } from '../../util.ts';
import { parseNpmrcCooldown } from '../extract/npmrc.ts';
import { NpmrcCooldown, PackageLock } from '../schema.ts';
import type { NpmManagerData } from '../types.ts';
import { composeLockFile, parseLockFile } from '../utils.ts';
import { getNodeToolConstraint } from './node-version.ts';
import type { GenerateLockFileResult, NpmrcCooldownResult } from './types.ts';
import {
  getNodeOptions,
  getPackageManagerVersion,
  lazyLoadPackageJson,
} from './utils.ts';

export function parseNpmrcCooldownDate(
  npmrcContent: string | null,
): NpmrcCooldownResult | null {
  if (!npmrcContent) {
    return null;
  }

  const parsed = NpmrcCooldown.parse(npmrcContent);

  const before = parsed.before;
  if (isNonEmptyString(before)) {
    const dt = DateTime.fromISO(before, { zone: 'utc' });
    if (dt.isValid) {
      return { date: dt, source: 'before' };
    }
    logger.debug(`Invalid before date in .npmrc: ${before}, ignoring`);
  }

  const minReleaseAge = parsed['min-release-age'];
  if (isNonEmptyString(minReleaseAge)) {
    const days = parseInt(minReleaseAge, 10);
    if (isNumber(days) && days >= 0) {
      return {
        date: DateTime.now().minus({ days }).toUTC(),
        source: 'min-release-age',
      };
    }
    logger.debug(
      `Invalid min-release-age in .npmrc: ${minReleaseAge}, ignoring`,
    );
  }

  return null;
}

async function getNpmConstraintFromPackageLock(
  lockFileDir: string,
  filename: string,
): Promise<string | null> {
  const packageLockFileName = upath.join(lockFileDir, filename);
  const packageLockContents = await readLocalFile(packageLockFileName, 'utf8');
  const packageLockJson = Result.parse(
    packageLockContents,
    PackageLock,
  ).unwrapOrNull();
  if (!packageLockJson) {
    logger.debug(`Could not parse ${packageLockFileName}`);
    return null;
  }
  const { lockfileVersion } = packageLockJson;
  if (lockfileVersion === 1) {
    logger.debug(`Using npm constraint <7 for lockfileVersion=1`);
    return `<7`;
  }
  if (lockfileVersion === 2) {
    logger.debug(`Using npm constraint <9 for lockfileVersion=2`);
    return `<9`;
  }
  return null;
}

function toHuman(durationMs: number): string {
  return Duration.fromMillis(durationMs).rescale().toHuman();
}

interface BeforeFlag {
  flag: string;
  notice?: string;
}

/**
 * Whether the `before` date of the `.npmrc` is older than a minimum release age of `ageMs`, where `0` means none.
 */
function isNpmrcBeforeOlder(
  npmrcDate: DateTime | undefined,
  ageMs: number,
): npmrcDate is DateTime {
  if (!npmrcDate) {
    return false;
  }
  return !ageMs || npmrcDate < DateTime.now().minus(ageMs);
}

/**
 * Describes the minimum release age which npm checks with a lowered age of `ageMs` and the `before` date of the `.npmrc`.
 */
function getCheckedMinimumReleaseAge(
  npmrcDate: DateTime | undefined,
  ageMs: number,
): string {
  if (isNpmrcBeforeOlder(npmrcDate, ageMs)) {
    return `the \`before\` date ${npmrcDate.toISO()} of the \`.npmrc\``;
  }
  return ageMs
    ? `a minimum release age of ${toHuman(ageMs)}`
    : 'no minimum release age';
}

/**
 * Returns the `--before` flag for `minimumReleaseAgeMs`, lowered to the smaller `minimumReleaseAge` of exempted updates, and the notice for such a lowering.
 */
function getBeforeFlag(
  minimumReleaseAgeMs: number,
  npmrcContent: string | null,
  upgrades: Upgrade<NpmManagerData>[],
): BeforeFlag {
  if (!minimumReleaseAgeMs) {
    return { flag: '' };
  }
  const npmrcCooldown = parseNpmrcCooldown(npmrcContent);

  // npm rejects --before when min-release-age is set in .npmrc,
  // so let the .npmrc handle cooldown natively in that case
  if (npmrcCooldown?.source === 'min-release-age') {
    logger.debug(
      `Skipping --before flag because .npmrc already contains min-release-age=${npmrcCooldown.days}`,
    );
    return { flag: '' };
  }

  const exemption = getMinimumReleaseAgeExemption(
    upgrades,
    'npm',
    minimumReleaseAgeMs,
  );
  const npmrcDate = npmrcCooldown?.date;
  let notice: string | undefined;
  let ageMs = minimumReleaseAgeMs;
  // npm applies an older `before` of the `.npmrc` anyway, so lowering would change nothing
  if (exemption && !isNpmrcBeforeOlder(npmrcDate, minimumReleaseAgeMs)) {
    ageMs = exemption.ageMs;
    const checked = getCheckedMinimumReleaseAge(npmrcDate, ageMs);
    logger.debug(
      `npm checks ${checked} instead of ${toHuman(minimumReleaseAgeMs)}, as the minimumReleaseAge of ${exemption.depNames.join(', ')} is smaller and their release is younger or has no timestamp`,
    );
    const packages = exemption.depNames.map((name) => `\`${name}\``).join(', ');
    notice = `npm checked ${checked} instead of ${toHuman(minimumReleaseAgeMs)} for this update, because the \`minimumReleaseAge\` of ${packages} is smaller. npm has no per-package exclude for \`--before\`.`;
  }
  if (!ageMs) {
    return { flag: '', notice };
  }

  let beforeDate = DateTime.now().minus(ageMs).toUTC();

  if (npmrcCooldown && npmrcCooldown.date < beforeDate) {
    logger.debug(
      {
        npmrcDate: npmrcCooldown.date.toISO(),
        beforeDate: beforeDate.toISO(),
      },
      'Using stricter .npmrc cooldown date over minimumReleaseAge date',
    );
    beforeDate = npmrcCooldown.date;
  }

  const beforeISO = beforeDate.toISO();
  logger.debug(`Setting npm --before=${beforeISO} based on minimumReleaseAge`);
  return { flag: ` --before=${beforeISO}`, notice };
}

/**
 * Returns the `--before` flag for the `minimumReleaseAge` of `config`.
 */
function getConfigBeforeFlag(
  config: Partial<PostUpdateConfig>,
  npmrcContent: string | null,
): string {
  if (!config.minimumReleaseAge) {
    return '';
  }
  const ms = toMs(config.minimumReleaseAge);
  if (ms === null) {
    logger.debug(
      {
        minimumReleaseAge: config.minimumReleaseAge,
      },
      'Invalid minimumReleaseAge, skipping --before for npm install',
    );
    return '';
  }
  const npmrcCooldown = parseNpmrcCooldownDate(npmrcContent);

  // npm rejects --before when min-release-age is set in .npmrc,
  // so let the .npmrc handle cooldown natively in that case
  if (npmrcCooldown?.source === 'min-release-age') {
    logger.debug(
      {
        npmrcMinReleaseAge: npmrcCooldown.date.toISO(),
        minimumReleaseAge: config.minimumReleaseAge,
      },
      'Skipping --before flag because .npmrc already contains min-release-age',
    );
    return '';
  }

  let beforeDate = DateTime.now().minus(ms).toUTC();

  if (npmrcCooldown && npmrcCooldown.date < beforeDate) {
    logger.debug(
      {
        npmrcDate: npmrcCooldown.date.toISO(),
        beforeDate: beforeDate.toISO(),
      },
      'Using stricter .npmrc cooldown date over minimumReleaseAge date',
    );
    beforeDate = npmrcCooldown.date;
  }

  const beforeISO = beforeDate.toISO();
  logger.debug(
    {
      beforeISO,
      minimumReleaseAge: config.minimumReleaseAge,
    },
    'Setting npm --before based on minimumReleaseAge',
  );
  return ` --before=${beforeISO}`;
}

export async function generateLockFile(
  lockFileDir: string,
  env: NodeJS.ProcessEnv,
  filename: string,
  config: Partial<PostUpdateConfig<NpmManagerData>> = {},
  upgrades: Upgrade<NpmManagerData>[] = [],
  npmrcContent: string | null = null,
): Promise<GenerateLockFileResult> {
  // TODO: don't assume package-lock.json is in the same directory
  const lockFileName = upath.join(lockFileDir, filename);

  logger.debug(`Spawning npm install to create ${lockFileDir}/${filename}`);
  const { skipInstalls, postUpdateOptions } = config;

  let lockFile: string | null = null;
  let beforeFallback = false;
  let minimumReleaseAgeNotice: string | undefined;
  try {
    const lazyPkgJson = lazyLoadPackageJson(lockFileDir);
    const npmToolConstraint: ToolConstraint = {
      toolName: 'npm',
      constraint:
        (await resolveToolConstraint(
          config,
          'npm',
          async () =>
            getPackageManagerVersion('npm', await lazyPkgJson.getValue()) ??
            (await getNpmConstraintFromPackageLock(lockFileDir, filename)),
        )) ?? null,
    };
    const supportsPreferDedupeFlag =
      !npmToolConstraint.constraint ||
      semver.intersects('>=7.0.0', npmToolConstraint.constraint);
    let commands: string[] = [];
    let cmdOptions = '';
    const needsDedupeWithoutFlag =
      postUpdateOptions?.includes('npmDedupe') === true &&
      !supportsPreferDedupeFlag;
    if (needsDedupeWithoutFlag || skipInstalls === false) {
      logger.debug('Performing node_modules install');
      cmdOptions += '--no-audit';
    } else {
      logger.debug('Updating lock file only');
      cmdOptions += '--package-lock-only --no-audit';
    }

    if (postUpdateOptions?.includes('npmDedupe') && supportsPreferDedupeFlag) {
      logger.debug('Deduplicate dependencies on installation');
      cmdOptions += ' --prefer-dedupe';
    }

    if (!GlobalConfig.get('allowScripts') || config.ignoreScripts) {
      cmdOptions += ' --ignore-scripts';
    }

    const minimumReleaseAgeOptions = {
      config,
      manager: 'npm',
      packageFile: upath.join(lockFileDir, 'package.json'),
      upgrades,
    };
    const isSyncEnabled = isPackageManagerSyncEnabled(minimumReleaseAgeOptions);
    let beforeFlag: string;
    if (isSyncEnabled) {
      const before = getBeforeFlag(
        calculatePackageManagerMinimumReleaseAgeMs(minimumReleaseAgeOptions),
        npmrcContent,
        upgrades,
      );
      beforeFlag = before.flag;
      minimumReleaseAgeNotice = before.notice;
    } else {
      beforeFlag = getConfigBeforeFlag(config, npmrcContent);
    }

    const extraEnv: ExtraEnv = {
      NPM_CONFIG_CACHE: env.NPM_CONFIG_CACHE,
      npm_config_store: env.npm_config_store,
    };

    const { nodeMaxMemory } = getToolSettingsOptions(config.toolSettings);
    if (nodeMaxMemory) {
      extraEnv.NODE_OPTIONS = getNodeOptions(nodeMaxMemory);
    }

    const execOptions: ExecOptions = {
      cwdFile: lockFileName,
      extraEnv,
      toolConstraints: [
        await getNodeToolConstraint(config, upgrades, lockFileDir, lazyPkgJson),
        ...(isNonEmptyString(npmToolConstraint.constraint)
          ? [npmToolConstraint]
          : []),
      ],
      docker: {},
    };
    /* v8 ignore next -- needs test */
    if (GlobalConfig.get('exposeAllEnv')) {
      extraEnv.NPM_AUTH = env.NPM_AUTH;
      extraEnv.NPM_EMAIL = env.NPM_EMAIL;
    }

    if (!upgrades.every((upgrade) => upgrade.isLockfileUpdate)) {
      // This command updates the lock file based on package.json
      commands.push(`npm install ${cmdOptions}${beforeFlag}`.trim());
    }

    // rangeStrategy = update-lockfile
    const lockUpdates = upgrades.filter((upgrade) => upgrade.isLockfileUpdate);

    // divide the deps in two categories: workspace and root
    const { lockRootUpdates, lockWorkspacesUpdates, workspaces, rootDeps } =
      divideWorkspaceAndRootDeps(lockFileDir, lockUpdates);

    if (workspaces.size && lockWorkspacesUpdates.length) {
      logger.debug('Performing lockfileUpdate (npm-workspaces)');
      for (const workspace of workspaces) {
        const currentWorkspaceUpdates = lockWorkspacesUpdates
          .filter((update) => update.workspace === workspace)
          .map((update) => update.managerData?.packageKey)
          .filter(isString)
          .filter((packageKey) => !rootDeps.has(packageKey));

        // v8 ignore else -- TODO: add test #40625
        if (currentWorkspaceUpdates.length) {
          const updateCmd = `npm install ${cmdOptions}${beforeFlag} --workspace=${quote(workspace)} ${currentWorkspaceUpdates
            .map(quote)
            .join(' ')}`;
          commands.push(updateCmd);
        }
      }
    }

    if (lockRootUpdates.length) {
      logger.debug('Performing lockfileUpdate (npm)');
      const updateCmd = `npm install ${cmdOptions}${beforeFlag} ${lockRootUpdates
        .map((update) => update.managerData?.packageKey)
        .filter(isString)
        .map(quote)
        .join(' ')}`;
      commands.push(updateCmd);
    }

    if (upgrades.some((upgrade) => upgrade.isRemediation)) {
      // We need to run twice to get the correct lock file
      commands.push(`npm install ${cmdOptions}${beforeFlag}`.trim());
    }

    // Lock file maintenance recreates the lock file from scratch, and a single
    // `npm install` can generate a lock file which is out of sync with
    // package.json, so we need to run the install a second time (#37531).
    // Skipped if `npmInstallTwice` is configured, as that doubles all install
    // commands already.
    if (
      upgrades.some((upgrade) => upgrade.isLockFileMaintenance) &&
      !postUpdateOptions?.includes('npmInstallTwice')
    ) {
      commands.push(`npm install ${cmdOptions}${beforeFlag}`.trim());
    }

    // postUpdateOptions
    if (
      config.postUpdateOptions?.includes('npmDedupe') &&
      !supportsPreferDedupeFlag
    ) {
      logger.debug('Performing npm dedupe after installation');
      commands.push('npm dedupe');
    }

    if (upgrades.find((upgrade) => upgrade.isLockFileMaintenance)) {
      logger.debug(
        `Removing ${lockFileName} first due to lock file maintenance upgrade`,
      );
      try {
        await deleteLocalFile(lockFileName);
      } catch (err) /* v8 ignore next -- TODO: add test #40625 */ {
        logger.debug(
          { err, lockFileName },
          'Error removing `package-lock.json` for lock file maintenance',
        );
      }
    }

    if (postUpdateOptions?.includes('npmInstallTwice')) {
      logger.debug('Running npm install twice');
      // Run the install command twice to ensure the lock file is up to date
      // iterate through commands and if any command starts with `npm install`, add it again
      const existingCommands = [...commands];
      commands = [];
      for (const command of existingCommands) {
        commands.push(command);
        // v8 ignore else -- TODO: add test #40625
        if (command.startsWith('npm install')) {
          commands.push(command);
        }
      }
    }

    // Run the commands, retrying without --before on ETARGET if needed.
    // With minimumReleaseAgePackageManagerSync, lock file maintenance does not
    // retry, as it relies on --before to enforce the minimum release age.
    const skipsBeforeRetry =
      isSyncEnabled &&
      upgrades.some((upgrade) => upgrade.isLockFileMaintenance);
    await exec(commands, execOptions).catch(async (err) => {
      if (
        beforeFlag &&
        !skipsBeforeRetry &&
        err.stderr?.includes('with a date before')
      ) {
        logger.debug('npm --before caused ETARGET, retrying without --before');
        const commandsWithoutBefore = commands.map((cmd) =>
          cmd.replace(beforeFlag, ''),
        );
        beforeFallback = true;
        return exec(commandsWithoutBefore, execOptions);
      }
      throw err;
    });

    // massage to shrinkwrap if necessary
    if (
      filename === 'npm-shrinkwrap.json' &&
      (await localPathExists(upath.join(lockFileDir, 'package-lock.json')))
    ) {
      await renameLocalFile(
        upath.join(lockFileDir, 'package-lock.json'),
        upath.join(lockFileDir, 'npm-shrinkwrap.json'),
      );
    }

    // Read the result
    // TODO #22198
    lockFile = (await readLocalFile(
      upath.join(lockFileDir, filename),
      'utf8',
    ))!;

    // Massage lockfile counterparts of package.json that were modified
    // because npm install was called with an explicit version for rangeStrategy=update-lockfile
    if (lockUpdates.length) {
      const { detectedIndent, lockFileParsed } = parseLockFile(lockFile);
      if (
        lockFileParsed?.lockfileVersion === 2 ||
        lockFileParsed?.lockfileVersion === 3
      ) {
        lockUpdates.forEach((lockUpdate) => {
          const depType = lockUpdate.depType as
            'dependencies' | 'optionalDependencies';

          // TODO #22198
          // v8 ignore else -- TODO: add test #40625
          if (
            lockFileParsed.packages?.['']?.[depType]?.[lockUpdate.packageName!]
          ) {
            lockFileParsed.packages[''][depType][lockUpdate.packageName!] =
              lockUpdate.newValue!;
          }
        });
        lockFile = composeLockFile(lockFileParsed, detectedIndent);
      }
    }
  } catch (err) {
    // v8 ignore if -- TODO: add test #40625
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug(
      {
        err,
        type: 'npm',
      },
      'lock file error',
    );
    // v8 ignore if -- TODO: add test #40625
    if (err.stderr?.includes('ENOSPC: no space left on device')) {
      throw new Error(SYSTEM_INSUFFICIENT_DISK_SPACE);
    }
    return { error: true, stderr: err.stderr };
  }
  return {
    error: !lockFile,
    lockFile,
    beforeFallback,
    minimumReleaseAgeNotice,
  };
}

export function divideWorkspaceAndRootDeps(
  lockFileDir: string,
  lockUpdates: Upgrade<NpmManagerData>[],
): {
  lockRootUpdates: Upgrade<NpmManagerData>[];
  lockWorkspacesUpdates: Upgrade<NpmManagerData>[];
  workspaces: Set<string>;
  rootDeps: Set<string>;
} {
  const lockRootUpdates: Upgrade<NpmManagerData>[] = []; // stores all upgrades which are present in root package.json
  const lockWorkspacesUpdates: Upgrade<NpmManagerData>[] = []; // stores all upgrades which are present in workspaces package.json
  const workspaces = new Set<string>(); // name of all workspaces
  const rootDeps = new Set<string>(); // packageName of all upgrades in root package.json (makes it check duplicate deps in root)

  // divide the deps in two categories: workspace and root
  for (const upgrade of lockUpdates) {
    upgrade.managerData ??= {};
    upgrade.managerData.packageKey = generatePackageKey(
      upgrade.packageName!,
      upgrade.newVersion!,
    );
    if (
      upgrade.managerData.workspacesPackages?.length &&
      isString(upgrade.packageFile)
    ) {
      const workspacePatterns = upgrade.managerData.workspacesPackages; // glob pattern or directory name/path
      const packageFileDir = trimSlashes(
        upgrade.packageFile.replace('package.json', ''),
      );

      // workspaceDir = packageFileDir - lockFileDir
      const workspaceDir = trimSlashes(
        packageFileDir.startsWith(lockFileDir)
          ? packageFileDir.slice(lockFileDir.length)
          : packageFileDir,
      );

      if (isNonEmptyString(workspaceDir)) {
        let workspaceName: string | undefined;
        // compare workspaceDir to workspace patterns
        // stop when the first match is found and
        // add workspaceDir to workspaces set and upgrade object
        for (const workspacePattern of workspacePatterns) {
          const massagedPattern = workspacePattern.replace(regEx(/^\.\//), '');
          if (minimatch(massagedPattern).match(workspaceDir)) {
            workspaceName = workspaceDir;
            break;
          }
        }
        if (workspaceName) {
          // v8 ignore else -- TODO: add test #40625
          if (
            !rootDeps.has(upgrade.managerData.packageKey) // prevent same dep from existing in root and workspace
          ) {
            workspaces.add(workspaceName);
            upgrade.workspace = workspaceName;
            lockWorkspacesUpdates.push(upgrade);
          }
        } else {
          logger.warn(
            { workspacePatterns, workspaceDir },
            'workspaceDir not found',
          );
        }
        continue;
      }
    }
    lockRootUpdates.push(upgrade);
    rootDeps.add(upgrade.managerData.packageKey);
  }

  return { lockRootUpdates, lockWorkspacesUpdates, workspaces, rootDeps };
}

function generatePackageKey(packageName: string, version: string): string {
  return `${packageName}@${version}`;
}
