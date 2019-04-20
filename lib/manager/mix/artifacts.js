const upath = require('upath');
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
  await logger.debug(`mix.getArtifacts(${packageFileName})`);
  if (updatedDeps === undefined || updatedDeps.length < 1) {
    logger.debug('No updated mix deps - returning null');
    return null;
  }
  if (!config.gitFs) {
    logger.warn(
      'Renovate administrator should enable gitFs in order to support mix.lock updating'
    );
    return null;
  }
  if (!config.localDir) {
    logger.debug('No local dir specified');
    return null;
  }
  const lockFileName = 'mix.lock';
  try {
    const localPackageFileName = upath.join(config.localDir, packageFileName);
    await fs.outputFile(localPackageFileName, newPackageFileContent);
  } catch (err) {
    logger.warn({ err, message: err.message }, 'mix.exs is not found');
    return {
      lockFileError: {
        lockFile: lockFileName,
        stderr: err.message,
      },
    };
  }

  const existingLockFileContent = await platform.getFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No mix.lock found');
    return null;
  }
  const localLockFileName = upath.join(config.localDir, lockFileName);
  let unlockCmd = 'mix deps.unlock ';
  const getCmd = 'mix deps.get';
  for (let i = 0; i < updatedDeps.length; i += 1) {
    unlockCmd += updatedDeps[i];
  }

  const startTime = process.hrtime();
  /* istanbul ignore next */
  try {
    const { stdout, stderr } = await exec(unlockCmd, {
      cwd: config.localDir,
    });
    logger.debug(stdout);
    if (stderr) logger.error('error: ' + stderr);
  } catch (err) {
    logger.warn(
      { err, message: err.message },
      'Failed to unlock Mix lock file'
    );
    return {
      lockFileError: {
        lockFile: lockFileName,
        stderr: err.message,
      },
    };
  }
  /* istanbul ignore next */
  try {
    const { stdout, stderr } = await exec(getCmd, {
      cwd: config.localDir,
    });
    logger.debug(stdout);
    if (stderr) logger.error('error: ' + stderr);
  } catch (err) {
    logger.warn(
      { err, message: err.message },
      'Failed to update Mix lock file'
    );
    return {
      lockFileError: {
        lockFile: lockFileName,
        stderr: err.message,
      },
    };
  }
  const duration = process.hrtime(startTime);
  const seconds = Math.round(duration[0] + duration[1] / 1e9);
  logger.info({ seconds, type: 'mix.lock' }, 'Updated lockfile');
  logger.debug('Returning updated mix.lock');
  const newCargoLockContent = await fs.readFile(localLockFileName, 'utf8');
  if (existingLockFileContent === newCargoLockContent) {
    logger.debug('mix.lock is unchanged');
    return null;
  }
  return [
    {
      file: {
        name: lockFileName,
        contents: newCargoLockContent,
      },
    },
  ];
}
