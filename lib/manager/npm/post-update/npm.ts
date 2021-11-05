import is from '@sindresorhus/is';
import { validRange } from 'semver';
import { quote } from 'shlex';
import { join } from 'upath';
import { getGlobalConfig } from '../../../config/global';
import {
  SYSTEM_INSUFFICIENT_DISK_SPACE,
  TEMPORARY_ERROR,
} from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { ExecOptions, exec } from '../../../util/exec';
import {
  move,
  outputFile,
  pathExists,
  readFile,
  remove,
} from '../../../util/fs';
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
      cmdOptions += '--no-audit';
    } else {
      logger.debug('Updating lock file only');
      cmdOptions += '--package-lock-only --no-audit';
    }

    if (!getGlobalConfig().allowScripts || config.ignoreScripts) {
      cmdOptions += ' --ignore-scripts';
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
        tagScheme: 'node',
        tagConstraint,
        preCommands,
      },
    };
    // istanbul ignore if
    if (getGlobalConfig().exposeAllEnv) {
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

    const lockFileName = join(cwd, filename);

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
    } else {
      // massage lock file for npm 7+
      try {
        const lockFileParsed = JSON.parse(await readFile(lockFileName, 'utf8'));
        const packageNames = Object.keys(lockFileParsed.packages);
        if (is.nonEmptyArray(packageNames)) {
          let lockFileMassaged = false;
          for (const { depName } of upgrades) {
            for (const packageName of packageNames) {
              if (
                packageName === `node_modules/${depName}` ||
                packageName.startsWith(`node_modules/${depName}/`)
              ) {
                logger.trace({ packageName }, 'Massaging out package name');
                lockFileMassaged = true;
                delete lockFileParsed.packages[packageName];
              }
            }
          }
          if (lockFileMassaged) {
            logger.debug('Writing massaged package-lock.json');
            await outputFile(
              lockFileName,
              JSON.stringify(lockFileParsed, null, 2)
            );
          }
        }
      } catch (err) {
        logger.warn({ err }, 'Error massaging package-lock.json');
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
