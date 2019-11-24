const { logger } = require('../../../logger');
const { getManagerList } = require('../../../manager');
const { getManagerConfig } = require('../../../config');
const { getManagerPackageFiles } = require('./manager-files');

module.exports = {
  extractAllDependencies,
};

async function extractAllDependencies(config) {
  const extractions = {};
  let fileCount = 0;
  for (const manager of getManagerList()) {
    if (
      config.enabledManagers.length &&
      !config.enabledManagers.includes(manager)
    ) {
      logger.debug(`${manager} is not in enabledManagers list - skipping`);
      continue; // eslint-disable-line
    }
    const managerConfig = getManagerConfig(config, manager);
    managerConfig.manager = manager;
    const packageFiles = await getManagerPackageFiles(managerConfig);
    if (packageFiles && packageFiles.length) {
      fileCount += packageFiles.length;
      logger.info(`Found ${manager} package files`);
      extractions[manager] = packageFiles;
    }
  }
  logger.debug(`Found ${fileCount} package file(s)`);
  return extractions;
}
