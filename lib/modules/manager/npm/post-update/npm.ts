// TODO: types (#22198)
import is from '@sindresorhus/is';
import semver from 'semver';
import upath from 'upath';
import { GlobalConfig } from '../../../../config/global';
import {
  SYSTEM_INSUFFICIENT_DISK_SPACE,
  TEMPORARY_ERROR,
} from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { exec } from '../../../../util/exec';
import type {
  ExecOptions,
  ExtraEnv,
  ToolConstraint,
} from '../../../../util/exec/types';
import {
  deleteLocalFile,
  localPathExists,
  readLocalFile,
  renameLocalFile,
} from '../../../../util/fs';
import { minimatch } from '../../../../util/minimatch';
import { trimSlashes } from '../../../../util/url';
import type { PostUpdateConfig, Upgrade } from '../../types';
import { composeLockFile, parseLockFile } from '../utils';
import { getNodeToolConstraint } from './node-version';
import type { GenerateLockFileResult } from './types';
import { getPackageManagerVersion, lazyLoadPackageJson } from './utils';

export async function generateLockFile(
  lockFileDir: string,
  env: NodeJS.ProcessEnv,
  filename: string,
  config: Partial<PostUpdateConfig> = {},
  upgrades: Upgrade[] = [],
): Promise<GenerateLockFileResult> {
  // TODO: don't assume package-lock.json is in the same directory
  const lockFileName = upath.join(lockFileDir, filename);

  logger.debug(`Spawning npm install to create ${lockFileDir}/${filename}`);
  const { skipInstalls, postUpdateOptions } = config;

  let lockFile: string | null = null;
  try {
    const lazyPgkJson = lazyLoadPackageJson(lockFileDir);
    const npmToolConstraint: ToolConstraint = {
      toolName: 'npm',
      constraint:
        config.constraints?.npm ??
        getPackageManagerVersion('npm', await lazyPgkJson.getValue()),
    };
    const supportsPreferDedupeFlag =
      !npmToolConstraint.constraint ||
      semver.intersects('>=7.0.0', npmToolConstraint.constraint);
    const commands: string[] = [];
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

    const extraEnv: ExtraEnv = {
      NPM_CONFIG_CACHE: env.NPM_CONFIG_CACHE,
      npm_config_store: env.npm_config_store,
    };
    const execOptions: ExecOptions = {
      cwdFile: lockFileName,
      extraEnv,
      toolConstraints: [
        await getNodeToolConstraint(config, upgrades, lockFileDir, lazyPgkJson),
        npmToolConstraint,
      ],
      docker: {},
    };
    // istanbul ignore if
    if (GlobalConfig.get('exposeAllEnv')) {
      extraEnv.NPM_AUTH = env.NPM_AUTH;
      extraEnv.NPM_EMAIL = env.NPM_EMAIL;
    }

    if (!upgrades.every((upgrade) => upgrade.isLockfileUpdate)) {
      // This command updates the lock file based on package.json
      commands.push(`npm install ${cmdOptions}`.trim());
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

        if (currentWorkspaceUpdates.length) {
          const updateCmd = `npm install ${cmdOptions} --workspace=${workspace} ${currentWorkspaceUpdates.join(
            ' ',
          )}`;
          commands.push(updateCmd);
        }
      }
    }

    if (lockRootUpdates.length) {
      logger.debug('Performing lockfileUpdate (npm)');
      const updateCmd =
        `npm install ${cmdOptions} ` +
        lockRootUpdates
          .map((update) => update.managerData?.packageKey)
          .join(' ');
      commands.push(updateCmd);
    }

    if (upgrades.some((upgrade) => upgrade.isRemediation)) {
      // We need to run twice to get the correct lock file
      commands.push(`npm install ${cmdOptions}`.trim());
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
      } catch (err) /* istanbul ignore next */ {
        logger.debug(
          { err, lockFileName },
          'Error removing package-lock.json for lock file maintenance',
        );
      }
    }

    // Run the commands
    await exec(commands, execOptions);

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
          if (
            lockFileParsed.packages?.['']?.[depType]?.[lockUpdate.packageName!]
          ) {
            lockFileParsed.packages[''][depType]![lockUpdate.packageName!] =
              lockUpdate.newValue!;
          }
        });
        lockFile = composeLockFile(lockFileParsed, detectedIndent);
      }
    }
  } catch (err) /* istanbul ignore next */ {
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
    if (err.stderr?.includes('ENOSPC: no space left on device')) {
      throw new Error(SYSTEM_INSUFFICIENT_DISK_SPACE);
    }
    return { error: true, stderr: err.stderr };
  }
  return { error: !lockFile, lockFile };
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
      is.string(upgrade.packageFile)
    ) {
      const workspacePatterns = upgrade.managerData.workspacesPackages; // glob pattern or directory name/path
      const packageFileDir = trimSlashes(
        upgrade.packageFile.replace('package.json', ''),
      );

      // workspaceDir = packageFileDir - lockFileDir
      const workspaceDir = trimSlashes(packageFileDir.replace(lockFileDir, ''));

      if (is.nonEmptyString(workspaceDir)) {
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
