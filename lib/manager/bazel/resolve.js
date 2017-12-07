const configParser = require('../../config');

module.exports = {
  resolvePackageFile,
};

async function resolvePackageFile(config, inputFile) {
  const packageFile = configParser.mergeChildConfig(config.bazel, inputFile);
  logger.debug(
    `Resolving packageFile ${JSON.stringify(packageFile.packageFile)}`
  );
  packageFile.content = await platform.getFile(packageFile.packageFile);
  if (!packageFile.content) {
    logger.debug('No packageFile content');
    return null;
  }
  return packageFile;
}
