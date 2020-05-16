import { readFile } from 'fs-extra';
import { join } from 'upath';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import { BinarySource } from '../../../util/exec/common';
import { PostUpdateConfig } from '../../common';

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
  let cmd = 'pnpm';
  try {
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
      cmd += volumes.map((v) => `-v "${v}":"${v}" `).join('');
      // istanbul ignore if
      if (config.dockerMapDotfiles) {
        const homeDir =
          process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
        const homeNpmrc = join(homeDir, '.npmrc');
        cmd += `-v ${homeNpmrc}:/home/ubuntu/.npmrc `;
      }
      const envVars = ['NPM_CONFIG_CACHE', 'npm_config_store'];
      cmd += envVars.map((e) => `-e ${e} `).join('');
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
