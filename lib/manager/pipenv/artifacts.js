const { exec } = require('child-process-promise');
const fs = require('fs-extra');
const upath = require('upath');
const { getUntrustedEnv } = require('../../util/env');

module.exports = {
  updateArtifacts,
};

async function updateArtifacts(
  pipfileName,
  updatedDeps,
  newPipfileContent,
  config
) {
  logger.debug(`pipenv.updateArtifacts(${pipfileName})`);
  process.env.PIPENV_CACHE_DIR =
    process.env.PIPENV_CACHE_DIR ||
    upath.join(config.cacheDir, './others/pipenv');
  await fs.ensureDir(process.env.PIPENV_CACHE_DIR);
  logger.debug('Using pipenv cache ' + process.env.PIPENV_CACHE_DIR);
  const lockFileName = pipfileName + '.lock';
  const existingLockFileContent = await platform.getFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No Pipfile.lock found');
    return null;
  }
  const cwd = upath.join(config.localDir, upath.dirname(pipfileName));
  let stdout;
  let stderr;
  try {
    const localPipfileFileName = upath.join(config.localDir, pipfileName);
    await fs.outputFile(localPipfileFileName, newPipfileContent);
    const localLockFileName = upath.join(config.localDir, lockFileName);
    const env =
      global.trustLevel === 'high'
        ? process.env
        : getUntrustedEnv(['LC_ALL', 'LANG', 'PIPENV_CACHE_DIR']);
    const startTime = process.hrtime();
    let cmd;
    if (config.binarySource === 'docker') {
      logger.info('Running pipenv via docker');
      cmd = `docker run --rm `;
      const volumes = [config.localDir, process.env.PIPENV_CACHE_DIR];
      cmd += volumes.map(v => `-v ${v}:${v} `).join('');
      const envVars = ['LC_ALL', 'LANG', 'PIPENV_CACHE_DIR'];
      cmd += envVars.map(e => `-e ${e} `).join('');
      cmd += `-w ${cwd} `;
      cmd += `renovate/pipenv pipenv`;
    } else {
      logger.info('Running pipenv via global command');
      cmd = 'pipenv';
    }
    const args = 'lock';
    logger.debug({ cmd, args }, 'pipenv lock command');
    ({ stdout, stderr } = await exec(`${cmd} ${args}`, {
      cwd,
      shell: true,
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
          contents: await fs.readFile(localLockFileName, 'utf8'),
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
