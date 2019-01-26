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
  const lockFileName = packageFileName.replace(/\.toml$/, '.lock');
  let stdout;
  let stderr;
  if (updatedDeps === undefined || updatedDeps.length < 1) {
    return null;
  }
  const existingLockFileContent = await platform.getFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No Cargo.lock found');
    return null;
  }
  const mainrs = upath.join(config.localDir, 'src/main.rs');
  await fs.ensureFile(mainrs);
  const localPackageFileName = upath.join(config.localDir, packageFileName);
  const localLockFileName = upath.join(config.localDir, lockFileName);
  try {
    await fs.outputFile(localPackageFileName, newPackageFileContent);
    logger.debug('Updating ' + lockFileName);
    for (let i = 0; i < updatedDeps.length; i += 1) {
      const dep = updatedDeps[i];
      // const spec = dep;
      const cmd =
        'cargo update --manifest-path ' + localPackageFileName + ' --package';
      // if (config.binarySource === 'docker') {
      //   cmd = 'docker run renovate/cargo update -p';
      // }
      const startTime = process.hrtime();
      try {
        await exec(`${cmd} ${dep}`, {
          shell: true,
        });
      } catch (err) {
        // NOTE: This code is ignored because it is quite difficult to test using jest,
        // since it requires throwing a ChildProcessError exception from
        // exec function which is not exported by child-process-promise module
        // It works when testing manually with actual crates
        /* istanbul ignore next */
        logger.debug(
          'Because there are multiple versions of the same dependency in this crate, update all dependencies in Cargo.lock'
        );
        /* istanbul ignore next */
        const msgStart = 'error: There are multiple';
        /* istanbul ignore next */
        if (err.code === 101 && err.stderr.startsWith(msgStart)) {
          updateAll(localPackageFileName);
        } else {
          throw err;
        }
        // const lines = err.stderr.split('\n');
        // for (let j = 2; j < lines.length-1; j += 1) {
        //   const spec = lines[j].trim();
        //   updateDep(localPackageFileName, spec);
        // }
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
    return {
      file: {
        name: lockFileName,
        contents: newCargoLockContent,
      },
    };
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

// async function updateDep(localPackageFileName, spec) {
//   const stdout;
//   const stderr;
//   const cmd =
//         'cargo update --manifest-path ' + localPackageFileName + ' -p';
//   // if (config.binarySource === 'docker') {
//   //   cmd = 'docker run renovate/cargo update -p';
//   // }
//   const startTime = process.hrtime();
//   ({ stdout, stderr } = await exec(`${cmd} ${spec}`, {
//     shell: true,
//   }));
//   const duration = process.hrtime(startTime);
//   const seconds = Math.round(duration[0] + duration[1] / 1e9);
//   logger.info(
//     { seconds, type: 'Cargo.lock', stdout, stderr },
//     'Updated lockfile for ' + spec
//   );
// }

// This function updates all dependencies in Cargo.lock, which are outdated,
// not only the ones which were updated by renovate. It is called when there
// are multiple versions of the same dependency in a crate and it is difficult
// to figure out which one needs to be updated.
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
