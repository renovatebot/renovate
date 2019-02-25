const upath = require('upath');
const process = require('process');
const fs = require('fs-extra');
const { exec } = require('child-process-promise');

module.exports = {
  getArtifacts,
};

// TODO: Make docker binarySource work
// TODO: Test with real crates
async function getArtifacts(
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config
) {
  await logger.debug({ config }, `cargo.getArtifacts(${packageFileName})`);
  if (updatedDeps === undefined || updatedDeps.length < 1) {
    logger.debug('No updated cargo deps - returning null');
    return null;
  }
  if (!config.gitFs) {
    logger.warn(
      'Cargo lock updating requires gitFs to be enabled by the Renovate administrator.'
    );
    return null;
  }
  const lockFileName = 'Cargo.lock';
  const existingLockFileContent = await platform.getFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No Cargo.lock found');
    return null;
  }
  const localPackageFileName = upath.join(config.localDir, packageFileName);
  const localLockFileName = upath.join(config.localDir, lockFileName);
  let stdout;
  let stderr;
  try {
    await fs.outputFile(localPackageFileName, newPackageFileContent);
    logger.debug('Updating ' + lockFileName);
    for (let i = 0; i < updatedDeps.length; i += 1) {
      const dep = updatedDeps[i];
      // TODO: document this command and why we use it
      const cmd =
        'cargo update --manifest-path ' + localPackageFileName + ' --package';
      // if (config.binarySource === 'docker') {
      //   cmd = 'docker run renovate/cargo update -p';
      // }
      const startTime = process.hrtime();
      try {
        ({ stdout, stderr } = await exec(`${cmd} ${dep}`, {
          shell: true,
        }));
      } catch (err) /* istanbul ignore next */ {
        const msgStart = 'error: There are multiple';
        // TODO: Document why we need to do this
        if (err.code === 101 && err.stderr.startsWith(msgStart)) {
          await updateAll(localPackageFileName);
        } else {
          throw err; // this is caught below
        }
      }
      const duration = process.hrtime(startTime);
      const seconds = Math.round(duration[0] + duration[1] / 1e9);
      logger.info(
        { seconds, type: 'Cargo.lock', stdout, stderr },
        'Updated lockfile'
      );
    }
    logger.debug('Returning updated Cargo.lock');
    const newCargoLockContent = await fs.readFile(localLockFileName, 'utf8');
    if (existingLockFileContent === newCargoLockContent) {
      logger.debug('Cargo.lock is unchanged');
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
  } catch (err) {
    logger.warn(
      { err, message: err.message },
      'Failed to update Cargo lock file'
    );
    return {
      lockFileError: {
        lockFile: lockFileName,
        stderr: err.message,
      },
    };
  }
}

/* istanbul ignore next */
async function updateAll(localPackageFileName) {
  const cmd = 'cargo update --manifest-path ' + localPackageFileName;
  // if (config.binarySource === 'docker') {
  //   cmd = 'docker run renovate/cargo update -p';
  // }
  let stdout = '';
  let stderr = '';
  const startTime = process.hrtime();
  ({ stdout, stderr } = await exec(`${cmd}`, {
    shell: true,
  }));
  const duration = process.hrtime(startTime);
  const seconds = Math.round(duration[0] + duration[1] / 1e9);
  logger.info(
    { seconds, type: 'Cargo.lock', stdout, stderr },
    'Updated lockfile for all dependencies'
  );
}
