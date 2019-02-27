module.exports = {
  getArtifacts,
};

/*
 *  The getArtifacts() function is optional and necessary only if it is necessary to update "artifacts"
 *  after updating package files. Artifacts are files such as lock files or checksum files.
 *  Usually this will require running a child process command to produce an update.
 */

async function getArtifacts(
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config
) {
  await logger.debug({ config }, `composer.getArtifacts(${packageFileName})`);
  return null;
}
