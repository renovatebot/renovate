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
  const existingLockFileContent = await platform.getFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug(`No ${lockFileName} found`);
    return null;
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
    for (let i = 0; i < updatedDeps.length; i += 1) {
      const dep = updatedDeps[i];
      const cmd = `poetry update --lock --no-interaction ${dep}`;
      ({ stdout, stderr } = await exec(cmd, {
        cwd,
        shell: true,
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
    return [
      {
        file: {
          name: lockFileName,
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
