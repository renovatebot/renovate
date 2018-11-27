const process = require('process');
const fs = require('fs');
const upath = require('upath');
const { exec } = require('child-process-promise');

module.exports = {
  getArtifacts,
};

// TODO: Make docker binarySource work
// TODO: Get Travis CI to pass succesfully
// TODO: Add more tests
async function getArtifacts(
  cargoTomlFileName,
  updatedDeps,
  newCargoTomlContent,
  config
) {
  await logger.debug({ config }, `cargo.getArtifacts(${cargoTomlFileName})`);
  let cargoLockFileName;
  let stdout;
  let stderr;
  try {
    if (updatedDeps === undefined || updatedDeps.length < 1) {
      return null;
    }
    cargoLockFileName = cargoTomlFileName.replace(/\.toml$/, '.lock');
    logger.debug('Updating ' + cargoLockFileName);
    for (let i = 0; i < updatedDeps.length; i += 1) {
      const dep = updatedDeps[i];
      // Unambiguous specification of a crate would be <crate_name>:<locked_version>,
      // might be required, because it is possible to have multiple versions of the
      // same dependency in the same project.
      // NOTE: Complex version requirements like '=0.2.0' might be a problem
      const spec = dep.depName;
      const cmd = 'cargo update -p';
      // if (config.binarySource === 'docker') {
      //   cmd = 'docker run renovate/cargo update -p';
      // }
      const startTime = process.hrtime();
      const oldDir = process.cwd();
      process.chdir(config.localDir);
      ({ stdout, stderr } = await exec(`${cmd} ${spec}`, {
        shell: true,
      }));
      process.chdir(oldDir);
      const duration = process.hrtime(startTime);
      const seconds = Math.round(duration[0] + duration[1] / 1e9);
      logger.info(
        { seconds, type: 'Cargo.lock', stdout, stderr },
        'Generated lockfile'
      );
    }
    logger.debug('Returning updated Cargo.lock');
    const cargoLockPath = upath.join(config.localDir, cargoLockFileName);
    const cargoLockContents = fs.readFileSync(cargoLockPath, 'utf8');
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
