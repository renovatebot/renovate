const configParser = require('../../config');
const depTypeWorker = require('../dep-type');
const npmApi = require('../../api/npm');

let logger = require('../../logger');

module.exports = {
  renovatePackageFile,
};

async function renovatePackageFile(packageFileConfig) {
  const config = { ...packageFileConfig };
  if (config.npmrc) {
    npmApi.setNpmrc(config.npmrc);
  }
  let upgrades = [];
  logger = config.logger;
  logger.info(`Processing package file`);

  // Check if config is disabled
  if (config.enabled === false) {
    logger.info('packageFile is disabled');
    return upgrades;
  }

  const depTypes = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ];
  const depTypeConfigs = depTypes.map(depType => {
    const depTypeConfig = configParser.mergeChildConfig(config, {
      ...config[depType],
    });
    depTypeConfig.depType = depType;
    depTypeConfig.logger = logger.child({
      repository: depTypeConfig.repository,
      packageFile: depTypeConfig.packageFile,
      depType: depTypeConfig.depType,
    });
    logger.trace({ config: depTypeConfig }, 'depTypeConfig');
    return configParser.filterConfig(depTypeConfig, 'depType');
  });
  logger.trace({ config: depTypeConfigs }, `depTypeConfigs`);
  for (const depTypeConfig of depTypeConfigs) {
    upgrades = upgrades.concat(
      await depTypeWorker.renovateDepType(config.content, depTypeConfig)
    );
  }
  if (
    config.lockFileMaintenance.enabled &&
    (config.hasYarnLock || config.hasPackageLock)
  ) {
    logger.debug('lockFileMaintenance enabled');
    // Maintain lock files
    const lockFileMaintenanceConf = configParser.mergeChildConfig(
      config,
      config.lockFileMaintenance
    );
    lockFileMaintenanceConf.type = 'lockFileMaintenance';
    logger.trace(
      { config: lockFileMaintenanceConf },
      `lockFileMaintenanceConf`
    );
    upgrades.push(configParser.filterConfig(lockFileMaintenanceConf, 'branch'));
  }

  logger.info('Finished processing package file');
  return upgrades;
}
