const path = require('path');
const configParser = require('../../config');
const depTypeWorker = require('../dep-type');

let logger = require('../../logger');

module.exports = {
  renovatePackageFile,
  getDepTypeConfig,
};

async function renovatePackageFile(packageFileConfig) {
  let config = Object.assign({}, packageFileConfig);
  logger = config.logger;
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
      await depTypeWorker.renovateDepType(packageContent, depTypeConfig)
    );
  }

  // Detect if a yarn.lock file is in use
  const yarnLockFileName = path.join(
    path.dirname(config.packageFile),
    'yarn.lock'
  );
  if (await config.api.getFileContent(yarnLockFileName)) {
    config.hasYarnLock = true;
  }
  const packageLockFileName = path.join(
    path.dirname(config.packageFile),
    'package-lock.json'
  );
  if (await config.api.getFileContent(packageLockFileName)) {
    config.hasPackageLock = true;
  }
  if (config.hasYarnLock || config.hasPackageLock) {
    // Maintain lock files
    const lockFileMaintenanceConf = configParser.mergeChildConfig(
      config,
      config.lockFileMaintenance
    );
    if (lockFileMaintenanceConf.enabled) {
      logger.debug('lockFileMaintenance enabled');
      lockFileMaintenanceConf.type = 'lockFileMaintenance';
      logger.debug(
        { config: lockFileMaintenanceConf },
        `lockFileMaintenanceConf`
      );
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
