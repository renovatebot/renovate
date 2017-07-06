const configParser = require('../../config');
const depTypeWorker = require('../dep-type');
const schedule = require('../package/schedule');

let logger = require('../../logger');

module.exports = {
  findUpgrades,
  getDepTypeConfig,
};

async function findUpgrades(packageFileConfig) {
  let config = Object.assign({}, packageFileConfig);
  logger = config.logger || logger;
  logger.info(`Processing package file`);
  // If onboarding, use the package.json in onboarding branch unless a custom base branch was defined
  const packageContent = await config.api.getFileJson(
    config.packageFile,
    config.contentBaseBranch
  );

  if (!packageContent) {
    config.depName = config.packageFile;
    config.type = 'error';
    config.message = 'No json content found';
    logger.warn(config.message);
    return [config];
  }

  // Check for renovate config inside the package.json
  if (packageContent.renovate) {
    logger.trace(
      { config: packageContent.renovate },
      'package.json>renovate config'
    );
    // package.json>renovate config takes precedence over existing config
    config = configParser.mergeChildConfig(config, packageContent.renovate);
  } else {
    logger.debug('Package file has no renovate configuration');
  }
  // Now check if config is disabled
  if (config.enabled === false) {
    logger.info('packageFile is disabled');
    return [];
  }

  const depTypeConfigs = config.depTypes.map(depType =>
    module.exports.getDepTypeConfig(config, depType)
  );
  logger.trace({ config: depTypeConfigs }, `depTypeConfigs`);
  let upgrades = [];
  for (const depTypeConfig of depTypeConfigs) {
    upgrades = upgrades.concat(
      await depTypeWorker.findUpgrades(packageContent, depTypeConfig)
    );
  }

  // Maintain lock files
  const lockFileMaintenanceConf = Object.assign(
    {},
    config,
    config.lockFileMaintenance
  );
  if (lockFileMaintenanceConf.enabled) {
    logger.debug('lockFileMaintenance enabled');
    lockFileMaintenanceConf.type = 'lockFileMaintenance';
    if (schedule.isScheduledNow(lockFileMaintenanceConf)) {
      logger.debug(`lock config=${JSON.stringify(lockFileMaintenanceConf)}`);
      upgrades.push(lockFileMaintenanceConf);
    }
  }

  logger.info('Finished processing package file');
  return upgrades;
}

function getDepTypeConfig(packageFileConfig, depType) {
  let depTypeConfig = typeof depType === 'string' ? { depType } : depType;
  depTypeConfig = configParser.mergeChildConfig(
    packageFileConfig,
    depTypeConfig
  );
  depTypeConfig.logger = logger.child({
    repository: depTypeConfig.repository,
    packageFile: depTypeConfig.packageFile,
    depType: depTypeConfig.depType,
  });
  return configParser.filterConfig(depTypeConfig, 'depType');
}
