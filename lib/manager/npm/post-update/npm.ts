import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import {
  SYSTEM_INSUFFICIENT_DISK_SPACE,
  TEMPORARY_ERROR,
} from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions, ToolConstraint } from '../../../util/exec/types';
import { move, pathExists, readFile, remove } from '../../../util/fs';
import type { PostUpdateConfig, Upgrade } from '../../types';
import { getNodeConstraint } from './node-version';
import type { GenerateLockFileResult } from './types';

export async function generateLockFile(
  cwd: string,
  env: NodeJS.ProcessEnv,
  filename: string,
  config: PostUpdateConfig = {},
  upgrades: Upgrade[] = []
): Promise<GenerateLockFileResult> {
  logger.debug(`Spawning npm install to create ${cwd}/${filename}`);
  const { skipInstalls, postUpdateOptions } = config;

  let lockFile = null;
  try {
    const npmToolConstraint: ToolConstraint = {
      toolName: 'npm',
      constraint: config.constraints?.npm,
    };
    const commands = [];
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

    const tagConstraint = await getNodeConstraint(config);
    const execOptions: ExecOptions = {
      cwd,
      extraEnv: {
        NPM_CONFIG_CACHE: env.NPM_CONFIG_CACHE,
        npm_config_store: env.npm_config_store,
      },
      toolConstraints: [npmToolConstraint],
      docker: {
        image: 'node',
        tagScheme: 'node',
        tagConstraint,
      },
    };
    // istanbul ignore if
    if (GlobalConfig.get('exposeAllEnv')) {
      execOptions.extraEnv.NPM_AUTH = env.NPM_AUTH;
      execOptions.extraEnv.NPM_EMAIL = env.NPM_EMAIL;
    }

    if (!upgrades.every((upgrade) => upgrade.isLockfileUpdate)) {
      // This command updates the lock file based on package.json
      commands.push(`npm install ${cmdOptions}`.trim());
    }

    // rangeStrategy = update-lockfile
    const lockUpdates = upgrades.filter((upgrade) => upgrade.isLockfileUpdate);
    if (lockUpdates.length) {
      logger.debug('Performing lockfileUpdate (npm)');
      const updateCmd =
        `npm install ${cmdOptions}` +
        lockUpdates
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

    // TODO: don't assume package-lock.json is in the same directory
    const lockFileName = upath.join(cwd, filename);

    if (upgrades.find((upgrade) => upgrade.isLockFileMaintenance)) {
      logger.debug(
        `Removing ${lockFileName} first due to lock file maintenance upgrade`
      );
      try {
        await remove(lockFileName);
      } catch (err) /* istanbul ignore next */ {
        logger.debug(
          { err, lockFileName },
          'Error removing yarn.lock for lock file maintenance'
        );
      }
    }

    // Run the commands
    await exec(commands, execOptions);

    // massage to shrinkwrap if necessary
    if (
      filename === 'npm-shrinkwrap.json' &&
      (await pathExists(upath.join(cwd, 'package-lock.json')))
    ) {
      await move(
        upath.join(cwd, 'package-lock.json'),
        upath.join(cwd, 'npm-shrinkwrap.json')
      );
    }

    // Read the result
    lockFile = await readFile(upath.join(cwd, filename), 'utf8');
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
