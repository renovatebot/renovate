import { move, pathExists, readFile } from 'fs-extra';
import { join } from 'upath';
import { SYSTEM_INSUFFICIENT_DISK_SPACE } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import { BinarySource } from '../../../util/exec/common';
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
  let lockFile: string = null;
  let stdout = '';
  let stderr = '';
  let cmd = 'npm';
  let args = '';
  try {
    // istanbul ignore if
    if (config.binarySource === BinarySource.Docker) {
      logger.debug('Running npm via docker');
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
      if (config.dockerMapDotfiles) {
        const homeDir =
          process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
        const homeNpmrc = join(homeDir, '.npmrc');
        cmd += `-v ${homeNpmrc}:/home/ubuntu/.npmrc `;
      }
      const envVars = ['NPM_CONFIG_CACHE', 'npm_config_store'];
      cmd += envVars.map((e) => `-e ${e} `).join('');
      cmd += `-w "${cwd}" `;
      cmd += `renovate/npm npm`;
    }
    logger.debug(`Using npm: ${cmd}`);
    args = `install`;
    if (
      (postUpdateOptions && postUpdateOptions.includes('npmDedupe')) ||
      skipInstalls === false
    ) {
      logger.debug('Performing full npm install');
      args += ' --ignore-scripts --no-audit';
    } else {
      args += ' --package-lock-only --no-audit';
    }
    logger.debug(`Using npm: ${cmd} ${args}`);
    // istanbul ignore if
    if (!upgrades.every((upgrade) => upgrade.isLockfileUpdate)) {
      // TODO: Switch to native util.promisify once using only node 8
      ({ stdout, stderr } = await exec(`${cmd} ${args}`, {
        cwd,
        env,
      }));
    }
    const lockUpdates = upgrades.filter((upgrade) => upgrade.isLockfileUpdate);
    if (lockUpdates.length) {
      logger.debug('Performing lockfileUpdate (npm)');
      const updateCmd =
        `${cmd} ${args}` +
        lockUpdates
          .map((update) => ` ${update.depName}@${update.toVersion}`)
          .join('');
      const updateRes = await exec(updateCmd, {
        cwd,
        env,
      });
      stdout += updateRes.stdout ? updateRes.stdout : '';
      stderr += updateRes.stderr ? updateRes.stderr : '';
    }
    if (postUpdateOptions && postUpdateOptions.includes('npmDedupe')) {
      logger.debug('Performing npm dedupe');
      const dedupeRes = await exec(`${cmd} dedupe`, {
        cwd,
        env,
      });
      stdout += dedupeRes.stdout ? dedupeRes.stdout : '';
      stderr += dedupeRes.stderr ? dedupeRes.stderr : '';
    }
    // istanbul ignore if
    if (stderr && stderr.includes('ENOSPC: no space left on device')) {
      throw new Error(SYSTEM_INSUFFICIENT_DISK_SPACE);
    }
    if (
      filename === 'npm-shrinkwrap.json' &&
      (await pathExists(join(cwd, 'package-lock.json')))
    ) {
      await move(
        join(cwd, 'package-lock.json'),
        join(cwd, 'npm-shrinkwrap.json')
      );
    }
    lockFile = await readFile(join(cwd, filename), 'utf8');
  } catch (err) /* istanbul ignore next */ {
    logger.debug(
      {
        cmd,
        args,
        err,
        stdout,
        stderr,
        type: 'npm',
      },
      'lock file error'
    );
    return { error: true, stderr: err.stderr };
  }
  return { lockFile };
}
