// TODO: types (#22198)
import { isNonEmptyString, isNumber, isString } from '@sindresorhus/is';
import ini from 'ini';
import { DateTime } from 'luxon';
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
import { toMs } from '../../../../util/pretty-time.ts';
import { Result } from '../../../../util/result.ts';
import { trimSlashes } from '../../../../util/url.ts';
import type { PostUpdateConfig, Upgrade } from '../../types.ts';
import { PackageLock } from '../schema.ts';
import { composeLockFile, parseLockFile } from '../utils.ts';
import { getNodeToolConstraint } from './node-version.ts';
import type { GenerateLockFileResult } from './types.ts';
import {
  getNodeOptions,
  getPackageManagerVersion,
  lazyLoadPackageJson,
} from './utils.ts';

export function parseNpmrcCooldownDate(
  npmrcContent: string | null,
): DateTime<true> | null {
  if (!npmrcContent) {
    return null;
  }

  const parsed = ini.parse(npmrcContent);

  const before = parsed.before;
  if (isNonEmptyString(before)) {
    const parsed = DateTime.fromISO(before, { zone: 'utc' });
    if (parsed.isValid) {
      return parsed;
    }
    logger.debug(`Invalid before date in .npmrc: ${before}, ignoring`);
  }

  const minReleaseAge = parsed['min-release-age'];
  if (isNonEmptyString(minReleaseAge)) {
    const days = parseInt(minReleaseAge, 10);
    if (isNumber(days) && days >= 0) {
      return DateTime.now().minus({ days }).toUTC();
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

export async function generateLockFile(
  lockFileDir: string,
  env: NodeJS.ProcessEnv,
  filename: string,
  config: Partial<PostUpdateConfig> = {},
  upgrades: Upgrade[] = [],
  npmrcContent: string | null = null,
): Promise<GenerateLockFileResult> {
  // TODO: don't assume package-lock.json is in the same directory
  const lockFileName = upath.join(lockFileDir, filename);

  logger.debug(`Spawning npm install to create ${lockFileDir}/${filename}`);
  const { skipInstalls, postUpdateOptions } = config;

  let lockFile: string | null = null;
  let beforeFallback = false;
  try {
    const lazyPkgJson = lazyLoadPackageJson(lockFileDir);
    const npmToolConstraint: ToolConstraint = {
      toolName: 'npm',
      constraint:
        config.constraints?.npm ??
        getPackageManagerVersion('npm', await lazyPkgJson.getValue()) ??
        (await getNpmConstraintFromPackageLock(lockFileDir, filename)) ??
        null,
    };
    const supportsPreferDedupeFlag =
      !npmToolConstraint.constraint ||
      semver.intersects('>=7.0.0', npmToolConstraint.constraint);
    let commands: string[] = [];
    let cmdOptions = '';
    if (
      (postUpdateOptions?.includes('npmDedupe') === true &&
        !supportsPreferDedupeFlag) ||
      skipInstalls === false
    ) {
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

    let beforeFlag = '';
    if (config.minimumReleaseAge) {
      const ms = toMs(config.minimumReleaseAge);
      if (ms === null) {
        logger.debug(
          {
            minimumReleaseAge: config.minimumReleaseAge,
          },
          'Invalid minimumReleaseAge, skipping --before for npm install',
        );
      } else {
        let beforeDate = DateTime.now().minus(ms).toUTC();

        const npmrcDate = parseNpmrcCooldownDate(npmrcContent);
        if (npmrcDate && npmrcDate < beforeDate) {
          logger.debug(
            {
              npmrcDate: npmrcDate.toISO(),
              beforeDate: beforeDate.toISO(),
            },
            'Using stricter .npmrc cooldown date over minimumReleaseAge date',
          );
          beforeDate = npmrcDate;
        }

        const beforeISO = beforeDate.toISO();
        logger.debug(
          {
            beforeISO,
            minimumReleaseAge: config.minimumReleaseAge,
          },
          'Setting npm --before based on minimumReleaseAge',
        );
        beforeFlag = ` --before=${beforeISO}`;
      }
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
    /* v8 ignore next 4 -- needs test */
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
        .map(quote)
        .join(' ')}`;
      commands.push(updateCmd);
    }

    if (upgrades.some((upgrade) => upgrade.isRemediation)) {
      // We need to run twice to get the correct lock file
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

    // Run the commands, retrying without --before on ETARGET if needed
    await exec(commands, execOptions).catch(async (err) => {
      if (beforeFlag && err.stderr?.includes('with a date before')) {
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
            | 'dependencies'
            | 'optionalDependencies';

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
  return { error: !lockFile, lockFile, beforeFallback };
}

export function divideWorkspaceAndRootDeps(
  lockFileDir: string,
  lockUpdates: Upgrade[],
): {
  lockRootUpdates: Upgrade[];
  lockWorkspacesUpdates: Upgrade[];
  workspaces: Set<string>;
  rootDeps: Set<string>;
} {
  const lockRootUpdates: Upgrade[] = []; // stores all upgrades which are present in root package.json
  const lockWorkspacesUpdates: Upgrade[] = []; // stores all upgrades which are present in workspaces package.json
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
          const massagedPattern = (workspacePattern as string).replace(
            /^\.\//,
            '',
          );
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
