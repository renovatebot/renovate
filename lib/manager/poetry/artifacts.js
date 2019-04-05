const upath = require('upath');
const process = require('process');
const fs = require('fs-extra');
const { exec } = require('child-process-promise');

module.exports = {
  getArtifacts,
};

async function getArtifacts(
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config
) {
  await logger.debug(`poetry.getArtifacts(${packageFileName})`);
  if (updatedDeps === undefined || updatedDeps.length < 1) {
    logger.debug('No updated poetry deps - returning null');
    return null;
  }
  const lockFileName = 'poetry.lock';
  let existingLockFileContent = await platform.getFile(lockFileName);
  let oldLockFileName;
  if (!existingLockFileContent) {
    oldLockFileName = 'pyproject.lock';
    existingLockFileContent = await platform.getFile(oldLockFileName);
    // istanbul ignore if
    if (existingLockFileContent) {
      logger.info(`${oldLockFileName} found`);
    } else {
      logger.debug(`No ${lockFileName} found`);
      return null;
    }
  }
  const localPackageFileName = upath.join(config.localDir, packageFileName);
  const localLockFileName = upath.join(config.localDir, lockFileName);
  let stdout;
  let stderr;
  const startTime = process.hrtime();
  try {
    await fs.outputFile(localPackageFileName, newPackageFileContent);
    logger.debug(`Updating ${lockFileName}`);
    const cwd = config.localDir;
    const env =
      global.trustLevel === 'high'
        ? process.env
        : {
            HOME: process.env.HOME,
            PATH: process.env.PATH,
          };
    let cmd;
    // istanbul ignore if
    if (config.binarySource === 'docker') {
      logger.info('Running poetry via docker');
      cmd = `docker run --rm `;
      const volumes = [cwd];
      cmd += volumes.map(v => `-v ${v}:${v} `).join('');
      const envVars = [];
      cmd += envVars.map(e => `-e ${e} `);
      cmd += `-w ${cwd} `;
      cmd += `renovate/poetry poetry`;
    } else {
      logger.info('Running poetry via global poetry');
      cmd = 'poetry';
    }
    for (let i = 0; i < updatedDeps.length; i += 1) {
      const dep = updatedDeps[i];
      cmd += ` update --lock --no-interaction ${dep}`;
      ({ stdout, stderr } = await exec(cmd, {
        cwd,
        shell: true,
        env,
      }));
    }
    const duration = process.hrtime(startTime);
    const seconds = Math.round(duration[0] + duration[1] / 1e9);
    logger.info(
      { seconds, type: `${lockFileName}`, stdout, stderr },
      'Updated lockfile'
    );
    logger.debug(`Returning updated ${lockFileName}`);
    const newPoetryLockContent = await fs.readFile(localLockFileName, 'utf8');
    if (existingLockFileContent === newPoetryLockContent) {
      logger.debug(`${lockFileName} is unchanged`);
      return null;
    }
    let fileName;
    if (oldLockFileName) {
      fileName = oldLockFileName;
    } else {
      fileName = lockFileName;
    }
    return [
      {
        file: {
          name: fileName,
          contents: newPoetryLockContent,
        },
      },
    ];
  } catch (err) {
    logger.warn(
      { err, message: err.message },
      `Failed to update ${lockFileName} file`
    );
    return {
      lockFileError: {
        lockFile: lockFileName,
        stderr: err.message,
      },
    };
  }
}
