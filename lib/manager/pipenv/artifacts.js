const { exec } = require('child-process-promise');
const fs = require('fs-extra');
const upath = require('upath');

module.exports = {
  getArtifacts,
};

async function getArtifacts(
  pipfileName,
  updatedDeps,
  newPipfileContent,
  config
) {
  logger.debug(`pipenv.getArtifacts(${pipfileName})`);
  const lockFileName = pipfileName + '.lock';
  const existingLockFileContent = await platform.getFile(lockFileName);
  const cwd = upath.join(config.localDir, upath.dirname(pipfileName));
  let stdout;
  let stderr;
  try {
    const localPipfileFileName = upath.join(config.localDir, pipfileName);
    await fs.outputFile(localPipfileFileName, newPipfileContent);
    const localLockFileName = upath.join(config.localDir, lockFileName);
    const env =
      config.global && config.global.exposeEnv
        ? process.env
        : {
            HOME: process.env.HOME,
            PATH: process.env.PATH,
            LC_ALL: process.env.LC_ALL,
            LANG: process.env.LANG,
          };
    const startTime = process.hrtime();
    let cmd;
    if (config.binarySource === 'docker') {
      logger.info('Running pipenv via docker');
      cmd = `docker run --rm `;
      const volumes = [config.localDir];
      cmd += volumes.map(v => `-v ${v}:${v} `).join('');
      const envVars = ['LC_ALL', 'LANG'];
      cmd += envVars.map(e => `-e ${e} `);
      cmd += `-w ${cwd} `;
      cmd += `renovate/pipenv pipenv`;
    } else {
      logger.info('Running pipenv via global command');
      cmd = 'pipenv';
    }
    const args = 'update';
    logger.debug({ cmd, args }, 'pipenv update command');
    ({ stdout, stderr } = await exec(`${cmd} ${args}`, {
      cwd,
      shell: true,
      env,
    }));
    const duration = process.hrtime(startTime);
    const seconds = Math.round(duration[0] + duration[1] / 1e9);
    logger.info(
      { seconds, type: 'Pipfile.lock', stdout, stderr },
      'Generated lockfile'
    );
    // istanbul ignore if
    if (config.gitFs) {
      const status = await platform.getRepoStatus();
      if (!status.modified.includes(lockFileName)) {
        return null;
      }
    } else {
      const newLockFileContent = await fs.readFile(localLockFileName, 'utf8');

      if (newLockFileContent === existingLockFileContent) {
        logger.debug('Pipfile.lock is unchanged');
        return null;
      }
    }
    logger.debug('Returning updated Pipfile.lock');
    return {
      file: {
        name: lockFileName,
        contents: await fs.readFile(localLockFileName, 'utf8'),
      },
    };
  } catch (err) {
    logger.warn({ err, message: err.message }, 'Failed to update Pipfile.lock');
    return {
      lockFileError: {
        lockFile: lockFileName,
        stderr: err.message,
      },
    };
  }
}
