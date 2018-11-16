module.exports = {
  getArtifacts,
};

async function getArtifacts(
  cargoTomlFileName,
  updatedDeps,
  newCargoTomlContent,
  config
) {
  await logger.debug({ config }, `cargo.getArtifacts(${cargoTomlFileName})`);
  let cargoLockFileName;
  try {
    cargoLockFileName = cargoTomlFileName.replace(/\.toml$/, '.lock');
    logger.debug('Updating ' + cargoLockFileName);
    // TODO: Update cargo lock file
    return null;
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
