const { mergeChildConfig } = require('../../config');

module.exports = {
  resolvePackageFile,
};

async function resolvePackageFile(config, inputFile) {
  const nvmConfig = mergeChildConfig(config.node, config.nvm);
  const packageFile = mergeChildConfig(nvmConfig, inputFile);
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
