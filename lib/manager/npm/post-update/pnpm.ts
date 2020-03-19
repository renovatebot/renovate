import { readFile } from 'fs-extra';
import { join } from 'upath';
import { getInstalledPath } from 'get-installed-path';
import { exec } from '../../../util/exec';
import { logger } from '../../../logger';
import { PostUpdateConfig } from '../../common';
import { BinarySource } from '../../../util/exec/common';

export interface GenerateLockFileResult {
  error?: boolean;
  lockFile?: string;
  stderr?: string;
  stdout?: string;
}

export async function generateLockFile(
  cwd: string,
  env: NodeJS.ProcessEnv,
  config: PostUpdateConfig
): Promise<GenerateLockFileResult> {
  logger.debug(`Spawning pnpm install to create ${cwd}/pnpm-lock.yaml`);
  let lockFile = null;
  let stdout: string;
  let stderr: string;
  let cmd: string;
  try {
    try {
      // See if renovate is installed locally
      const installedPath = join(
        await getInstalledPath('pnpm', {
          local: true,
        }),
        'lib/bin/pnpm.js'
      );
      cmd = `node ${installedPath}`;
    } catch (localerr) {
      logger.debug('No locally installed pnpm found');
      // Look inside globally installed renovate
      try {
        const renovateLocation = await getInstalledPath('renovate');
        const installedPath = join(
          await getInstalledPath('pnpm', {
            local: true,
            cwd: renovateLocation,
          }),
          'lib/bin/pnpm.js'
        );
        cmd = `node ${installedPath}`;
      } catch (nestederr) {
        logger.debug('Could not find globally nested pnpm');
        // look for global pnpm
        try {
          const installedPath = join(
            await getInstalledPath('pnpm'),
            'lib/bin/pnpm.js'
          );
          cmd = `node ${installedPath}`;
        } catch (globalerr) {
          logger.warn('Could not find globally installed pnpm');
          cmd = 'pnpm';
        }
      }
    }
    if (config.binarySource === BinarySource.Global) {
      cmd = 'pnpm';
    }
    if (config.binarySource === BinarySource.Docker) {
      logger.debug('Running pnpm via docker');
      cmd = `docker run --rm `;
      // istanbul ignore if
      if (config.dockerUser) {
        cmd += `--user=${config.dockerUser} `;
      }
      const volumes = [cwd];
      if (config.cacheDir) {
        volumes.push(config.cacheDir);
      }
      cmd += volumes.map(v => `-v "${v}":"${v}" `).join('');
      // istanbul ignore if
      if (config.dockerMapDotfiles) {
        const homeDir =
          process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
        const homeNpmrc = join(homeDir, '.npmrc');
        cmd += `-v ${homeNpmrc}:/home/ubuntu/.npmrc `;
      }
      const envVars = ['NPM_CONFIG_CACHE', 'npm_config_store'];
      cmd += envVars.map(e => `-e ${e} `).join('');
      cmd += `-w "${cwd}" `;
      cmd += `renovate/pnpm pnpm`;
    }
    logger.debug(`Using pnpm: ${cmd}`);
    cmd += ' install';
    cmd += ' --lockfile-only';
    if (global.trustLevel !== 'high' || config.ignoreScripts) {
      cmd += ' --ignore-scripts';
      cmd += ' --ignore-pnpmfile';
    }
    // TODO: Switch to native util.promisify once using only node 8
    ({ stdout, stderr } = await exec(cmd, {
      cwd,
      env,
    }));
    lockFile = await readFile(join(cwd, 'pnpm-lock.yaml'), 'utf8');
  } catch (err) /* istanbul ignore next */ {
    logger.debug(
      {
        cmd,
        err,
        stdout,
        stderr,
        type: 'pnpm',
      },
      'lock file error'
    );
    return { error: true, stderr: err.stderr, stdout: err.stdout };
  }
  return { lockFile };
}
