const { getManagerList } = require('../../../manager');
const { getManagerConfig } = require('../../../config');
const { getManagerPackageFiles } = require('./manager-files');

module.exports = {
  extractDependencies,
};

async function extractDependencies(config) {
  const extractions = {};
  let fileCount = 0;
  for (const manager of getManagerList()) {
    const managerConfig = getManagerConfig(config, manager);
    managerConfig.manager = manager;
    const packageFiles = await getManagerPackageFiles(config, managerConfig);
    if (packageFiles.length) {
      fileCount += packageFiles.length;
      extractions[manager] = packageFiles;
    }
  }
  logger.debug(`Found ${fileCount.length} package file(s)`);
  return extractions;
}
