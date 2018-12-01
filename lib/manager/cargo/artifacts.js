const process = require('process');
const fs = require('fs-extra');
const upath = require('upath');
const { exec } = require('child-process-promise');

module.exports = {
  getArtifacts,
};

// TODO: Make docker binarySource work
// TODO: Get Travis CI to pass succesfully
// TODO: Add more tests
async function getArtifacts(
  // Package file is always Cargo.lock
  // is this argument necessary?
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config
) {
  await logger.debug({ config }, `cargo.getArtifacts(${packageFileName})`);
  let cargoLockFileName;
  let stdout;
  let stderr;
  try {
    if (updatedDeps === undefined || updatedDeps.length < 1) {
      return null;
    }
    const manifestPath = upath.join(config.localDir, packageFileName);
    await fs.outputFile(manifestPath, newPackageFileContent);
    cargoLockFileName = packageFileName.replace(/\.toml$/, '.lock');
    logger.debug('Updating ' + cargoLockFileName);
    for (let i = 0; i < updatedDeps.length; i += 1) {
      const dep = updatedDeps[i];
      // Unambiguous specification of a crate would be <crate_name>:<locked_version>,
      // might be required, because it is possible to have multiple versions of the
      // same dependency in the same project.
      // NOTE: Complex version requirements like '=0.2.0' might be a problem
      const spec = dep.depName;
      const cmd = 'cargo update --manifest-path' + manifestPath + ' -p ' + spec;
      // if (config.binarySource === 'docker') {
      //   cmd = 'docker run renovate/cargo update -p';
      // }
      const startTime = process.hrtime();
      ({ stdout, stderr } = await exec(`${cmd} ${spec}`, {
        shell: true,
      }));
      const duration = process.hrtime(startTime);
      const seconds = Math.round(duration[0] + duration[1] / 1e9);
      logger.info(
        { seconds, type: 'Cargo.lock', stdout, stderr },
        'Generated lockfile'
      );
    }
    logger.debug('Returning updated Cargo.lock');
    const cargoLockPath = upath.join(config.localDir, cargoLockFileName);
    const cargoLockContents = await platform.getFile(cargoLockPath);
    return {
      file: {
        name: cargoLockFileName,
        contents: cargoLockContents,
      },
    };
  } catch (err) {
    logger.warn(
      { err, message: err.message },
      'Failed to update Cargo lock file'
    );
    return {
      lockFileError: {
        lockFile: cargoLockFileName,
        stderr: err.message,
      },
    };
  }
}
