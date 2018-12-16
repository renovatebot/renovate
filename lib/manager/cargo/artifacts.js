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
        ({ stdout, stderr } = await exec(`${cmd} ${dep}`, {
          shell: true,
        }));
      } catch (err) {
        logger.debug(
          'Because there are multiple versions of the same dependency in this crate update all dependencies in Cargo.lock'
        );
        updateAll(localPackageFileName);
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
