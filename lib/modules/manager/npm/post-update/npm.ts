import minimatch from 'minimatch';
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
import { trimLeadingSlash } from '../../../../util/url';
import type { PostUpdateConfig, Upgrade } from '../../types';
import { composeLockFile, parseLockFile } from '../utils';
import { getNodeToolConstraint } from './node-version';
import type { GenerateLockFileResult } from './types';

export async function generateLockFile(
  lockFileDir: string,
  env: NodeJS.ProcessEnv,
  filename: string,
  config: Partial<PostUpdateConfig> = {},
  upgrades: Upgrade[] = []
): Promise<GenerateLockFileResult> {
  // TODO: don't assume package-lock.json is in the same directory
  const lockFileName = upath.join(lockFileDir, filename);

  logger.debug(`Spawning npm install to create ${lockFileDir}/${filename}`);
  const { skipInstalls, postUpdateOptions } = config;

  let lockFile: string | null = null;
  try {
    const npmToolConstraint: ToolConstraint = {
      toolName: 'npm',
      constraint: config.constraints?.npm,
    };
    const commands: string[] = [];
    let cmdOptions = '';
    if (postUpdateOptions?.includes('npmDedupe') || skipInstalls === false) {
      logger.debug('Performing node_modules install');
      cmdOptions += '--no-audit';
    } else {
      logger.debug('Updating lock file only');
      cmdOptions += '--package-lock-only --no-audit';
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
        await getNodeToolConstraint(config, upgrades, lockFileDir),
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

    const lockRootUpdates: Upgrade<Record<string, any>>[] = []; // stores all upgrades which are present in root package.json
    const lockWorkspaceUpdates: Upgrade<Record<string, any>>[] = []; // stores all upgrades which are present in workspaces package.json
    const workspaces: Set<string> = new Set(); // name of all workspaces
    const rootDeps: Set<string> = new Set(); // depName of all upgrades in root package.json (makes it check duplicate deps in root)

    // divide the deps in two categories: workspace and root
    for (const upgrade of lockUpdates) {
      if (
        upgrade.isLockfileUpdate &&
        upgrade.managerData?.workspacesPackages.length
      ) {
        const workspacePatterns = upgrade.managerData?.workspacesPackages; // glob pattern or directory name/path
        const packageFileDir = upgrade.packageFile?.replace('package.json', '');

        // workspaceDir = packageFileDir - lockFileDir (root/workspace - root = workspace)
        const workspaceDir = trimLeadingSlash(
          packageFileDir?.replace(lockFileDir, '') ?? ''
        );

        // if packageFileDir === lockFileDir, dep is present in root package.json
        if (packageFileDir === lockFileDir) {
          lockRootUpdates.push(upgrade);
          rootDeps.add(`${upgrade.depName!}@${upgrade.newVersion!}`);
        }
        // else it is present in workspace package.json
        else {
          let workspaceName: string | undefined;
          // compare workspaceDir to workspace patterns
          // stop when the first match is found
          // add workspaceDir to workspaces set and upgrade object
          for (const workspacePattern of workspacePatterns ?? []) {
            if (workspaceDir && minimatch(workspaceDir, workspacePattern)) {
              workspaceName = workspaceDir;
              continue;
            }
          }
          if (
            workspaceName &&
            !rootDeps.has(`${upgrade.depName!}@${upgrade.newVersion!}`) // prevent same dep from existing in root and workspace
          ) {
            workspaces.add(workspaceName);
            upgrade.workspace = workspaceName;
            lockWorkspaceUpdates.push(upgrade);
          }
        }
      } else {
        lockRootUpdates.push(upgrade);
        rootDeps.add(`${upgrade.depName!}@${upgrade.newVersion!}`);
      }
    }

    if (workspaces.size) {
      logger.debug('Performing lockfileUpdate (npm-worspaces)');
      for (const workspace of workspaces) {
        const currentUpdates = lockWorkspaceUpdates
          .filter((update) => update.workspace === workspace)
          .filter(
            (update) =>
              !rootDeps.has(`${update.depName!}@${update.newVersion!}`) // filter out deps present in root again to be sure
          );
        const updateCmd =
          `npm install ${cmdOptions} --workspace=${workspace}` +
          currentUpdates
            // TODO: types (#7154)
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            .map((update) => ` ${update.depName}@${update.newVersion}`)
            .join('');
        commands.push(updateCmd);
      }
    }

    if (lockRootUpdates.length) {
      logger.debug('Performing lockfileUpdate (npm)');
      const updateCmd =
        `npm install ${cmdOptions}` +
        lockRootUpdates
          // TODO: types (#7154)
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          .map((update) => ` ${update.depName}@${update.newVersion}`)
          .join('');
      commands.push(updateCmd);
    }

    if (upgrades.some((upgrade) => upgrade.isRemediation)) {
      // We need to run twice to get the correct lock file
      commands.push(`npm install ${cmdOptions}`.trim());
    }

    // postUpdateOptions
    if (config.postUpdateOptions?.includes('npmDedupe')) {
      logger.debug('Performing npm dedupe');
      commands.push('npm dedupe');
    }

    if (upgrades.find((upgrade) => upgrade.isLockFileMaintenance)) {
      logger.debug(
        `Removing ${lockFileName} first due to lock file maintenance upgrade`
      );
      try {
        await deleteLocalFile(lockFileName);
      } catch (err) /* istanbul ignore next */ {
        logger.debug(
          { err, lockFileName },
          'Error removing package-lock.json for lock file maintenance'
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
        upath.join(lockFileDir, 'npm-shrinkwrap.json')
      );
    }

    // Read the result
    // TODO #7154
    lockFile = (await readLocalFile(
      upath.join(lockFileDir, filename),
      'utf8'
    ))!;

    // Massage lockfile counterparts of package.json that were modified
    // because npm install was called with an explicit version for rangeStrategy=update-lockfile
    if (lockUpdates.length) {
      const { detectedIndent, lockFileParsed } = parseLockFile(lockFile);
      if (lockFileParsed?.lockfileVersion === 2) {
        lockUpdates.forEach((lockUpdate) => {
          const depType = lockUpdate.depType as
            | 'dependencies'
            | 'optionalDependencies';

          // TODO #7154
          if (lockFileParsed.packages?.['']?.[depType]?.[lockUpdate.depName!]) {
            lockFileParsed.packages[''][depType]![lockUpdate.depName!] =
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
      'lock file error'
    );
    if (err.stderr?.includes('ENOSPC: no space left on device')) {
      throw new Error(SYSTEM_INSUFFICIENT_DISK_SPACE);
    }
    return { error: true, stderr: err.stderr };
  }
  return { lockFile };
}
