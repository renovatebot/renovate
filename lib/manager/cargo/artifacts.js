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
  await fs.ensureDir(mainrs);
  const localPackageFileName = upath.join(config.localDir, packageFileName);
  const localLockFileName = upath.join(config.localDir, lockFileName);
  try {
    await fs.outputFile(localPackageFileName, newPackageFileContent);
    logger.debug('Updating ' + lockFileName);
    for (let i = 0; i < updatedDeps.length; i += 1) {
      const dep = updatedDeps[i];
      // Unambiguous specification of a crate would be <crate_name>:<locked_version>,
      // might be required, because it is possible to have multiple versions of the
      // same dependency in the same project.
      // see cargo help pkgid for additional details
      // NOTE: Complex version requirements like '=0.2.0' might be a problem
      const spec = dep;
      const cmd =
        'cargo update --manifest-path ' + localPackageFileName + ' --package ';
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
