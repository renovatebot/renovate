import { move, pathExists, readFile } from 'fs-extra';
import { join } from 'upath';
import { SYSTEM_INSUFFICIENT_DISK_SPACE } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { ExecOptions, exec } from '../../../util/exec';
import { PostUpdateConfig, Upgrade } from '../../common';

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
    const preCommands = ['npm i -g yarn'];
    const commands = [];
    let cmdOptions = '';
    if (
      (postUpdateOptions && postUpdateOptions.includes('npmDedupe')) ||
      skipInstalls === false
    ) {
      logger.debug('Performing node_modules install');
      cmdOptions += '--ignore-scripts --no-audit';
    } else {
      logger.debug('Updating lock file only');
      cmdOptions += '--package-lock-only --no-audit';
    }
    const execOptions: ExecOptions = {
      cwd,
      extraEnv: {
        NPM_CONFIG_CACHE: env?.NPM_CONFIG_CACHE,
        npm_config_store: env?.npm_config_store,
      },
      docker: {
        image: 'renovate/node',
        preCommands,
      },
    };
    if (config.dockerMapDotfiles) {
      const homeDir =
        process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
      const homeNpmrc = join(homeDir, '.npmrc');
      execOptions.docker.volumes = [[homeNpmrc, '/home/ubuntu/.npmrc']];
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
          .map((update) => ` ${update.depName}@${update.toVersion}`)
          .join('');
      commands.push(updateCmd);
    }

    // postUpdateOptions
    if (config.postUpdateOptions?.includes('npmDedupe')) {
      logger.debug('Performing npm dedupe');
      commands.push('npm dedupe');
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
