import { ensureDir, outputFile, readFile } from 'fs-extra';
import { join, dirname } from 'upath';
import { exec } from '../../util/exec';
import { getChildProcessEnv } from '../../util/exec/env';
import { logger } from '../../logger';
import { UpdateArtifactsResult, UpdateArtifactsConfig } from '../common';
import { platform } from '../../platform';

export async function updateArtifacts(
  pipfileName: string,
  _updatedDeps: string[],
  newPipfileContent: string,
  config: UpdateArtifactsConfig
): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`pipenv.updateArtifacts(${pipfileName})`);

  const env = getChildProcessEnv(['LC_ALL', 'LANG', 'PIPENV_CACHE_DIR']);
  env.PIPENV_CACHE_DIR =
    env.PIPENV_CACHE_DIR || join(config.cacheDir, './others/pipenv');
  await ensureDir(env.PIPENV_CACHE_DIR);
  logger.debug('Using pipenv cache ' + env.PIPENV_CACHE_DIR);

  const lockFileName = pipfileName + '.lock';
  const existingLockFileContent = await platform.getFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No Pipfile.lock found');
    return null;
  }
  const cwd = join(config.localDir, dirname(pipfileName));
  let stdout: string;
  let stderr: string;
  try {
    const localPipfileFileName = join(config.localDir, pipfileName);
    await outputFile(localPipfileFileName, newPipfileContent);
    const localLockFileName = join(config.localDir, lockFileName);
    const startTime = process.hrtime();
    let cmd: string;
    if (config.binarySource === 'docker') {
      logger.info('Running pipenv via docker');
      cmd = `docker run --rm `;
      if (config.dockerUser) {
        cmd += `--user=${config.dockerUser} `;
      }
      const volumes = [config.localDir, env.PIPENV_CACHE_DIR];
      cmd += volumes.map(v => `-v "${v}":"${v}" `).join('');
      const envVars = ['LC_ALL', 'LANG', 'PIPENV_CACHE_DIR'];
      cmd += envVars.map(e => `-e ${e} `).join('');
      cmd += `-w "${cwd}" `;
      cmd += `renovate/pipenv pipenv`;
    } else {
      logger.info('Running pipenv via global command');
      cmd = 'pipenv';
    }
    const args = 'lock';
    logger.debug({ cmd, args }, 'pipenv lock command');
    ({ stdout, stderr } = await exec(`${cmd} ${args}`, {
      cwd,
      env,
    }));
    const duration = process.hrtime(startTime);
    const seconds = Math.round(duration[0] + duration[1] / 1e9);
    stdout = stdout ? stdout.replace(/(Locking|Running)[^\s]*?\s/g, '') : null;
    logger.info(
      { seconds, type: 'Pipfile.lock', stdout, stderr },
      'Generated lockfile'
    );
    const status = await platform.getRepoStatus();
    if (!(status && status.modified.includes(lockFileName))) {
      return null;
    }
    logger.debug('Returning updated Pipfile.lock');
    return [
      {
        file: {
          name: lockFileName,
          contents: await readFile(localLockFileName, 'utf8'),
        },
      },
    ];
  } catch (err) {
    logger.warn({ err }, 'Failed to update Pipfile.lock');
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: err.message,
        },
      },
    ];
  }
}
