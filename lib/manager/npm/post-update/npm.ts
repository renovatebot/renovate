import { validRange } from 'semver';
import { quote } from 'shlex';
import { join } from 'upath';
import { getAdminConfig } from '../../../config/admin';
import {
  SYSTEM_INSUFFICIENT_DISK_SPACE,
  TEMPORARY_ERROR,
} from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { ExecOptions, exec } from '../../../util/exec';
import { move, pathExists, readFile, remove } from '../../../util/fs';
import type { PostUpdateConfig, Upgrade } from '../../types';
import { getNodeConstraint } from './node-version';

export interface GenerateLockFileResult {
  error?: boolean;
  lockFile?: string;
  stderr?: string;
}

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
    let installNpm = 'npm i -g npm';
    const npmCompatibility = config.constraints?.npm as string;
    // istanbul ignore else
    if (npmCompatibility) {
      // istanbul ignore else
      if (validRange(npmCompatibility)) {
        installNpm = `npm i -g ${quote(`npm@${npmCompatibility}`)} || true`;
      } else {
        logger.debug(
          { npmCompatibility },
          'npm compatibility range is not valid - skipping'
        );
      }
    } else {
      logger.debug('No npm compatibility range found - installing npm latest');
    }
    const preCommands = [installNpm, 'hash -d npm'];
    const commands = [];
    let cmdOptions = '';
    if (postUpdateOptions?.includes('npmDedupe') || skipInstalls === false) {
      logger.debug('Performing node_modules install');
      cmdOptions += '--ignore-scripts --no-audit';
    } else {
      logger.debug('Updating lock file only');
      cmdOptions += '--package-lock-only --ignore-scripts --no-audit';
    }
    const tagConstraint = await getNodeConstraint(config);
    const execOptions: ExecOptions = {
      cwd,
      extraEnv: {
        NPM_CONFIG_CACHE: env.NPM_CONFIG_CACHE,
        npm_config_store: env.npm_config_store,
      },
      docker: {
        image: 'node',
        tagScheme: 'npm',
        tagConstraint,
        preCommands,
      },
    };
    // istanbul ignore if
    if (getAdminConfig().exposeAllEnv) {
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

    if (upgrades.find((upgrade) => upgrade.isLockFileMaintenance)) {
      const lockFileName = join(cwd, filename);
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
      (await pathExists(join(cwd, 'package-lock.json')))
    ) {
      await move(
        join(cwd, 'package-lock.json'),
        join(cwd, 'npm-shrinkwrap.json')
      );
    }

    // Read the result
    lockFile = await readFile(join(cwd, filename), 'utf8');
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
