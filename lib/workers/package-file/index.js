const configParser = require('../../config');
const depTypeWorker = require('../dep-type');
let logger = require('../../helpers/logger');

module.exports = {
  findUpgrades,
  getDepTypeConfig,
};

async function findUpgrades(config) {
  logger = config.logger || logger;
  logger.info(`Processing package file`);
  const packageContent = await config.api.getFileJson(config.packageFile);

  if (!packageContent) {
    logger.warn('No package.json content found - skipping');
    return [];
  }

  // Check for renovate config inside the package.json
  if (packageContent.renovate) {
    logger.debug(
      { config: packageContent.renovate },
      'package.json>renovate config'
    );
    // package.json>renovate config takes precedence over existing config
    Object.assign(config, packageContent.renovate);
  } else {
    logger.debug('Package file has no renovate configuration');
  }
  // Now check if config is disabled
  if (config.enabled === false) {
    logger.info('Config is disabled. Skipping');
    return [];
  }

  const depTypeConfigs = config.depTypes.map(depType =>
    module.exports.getDepTypeConfig(config, depType)
  );
  logger.debug(`depTypeConfigs=${JSON.stringify(depTypeConfigs)}`);
  let upgrades = [];
  for (const depTypeConfig of depTypeConfigs) {
    upgrades = upgrades.concat(
      await depTypeWorker.findUpgrades(packageContent, depTypeConfig)
    );
  }

  if (config.maintainYarnLock) {
    const upgrade = Object.assign({}, config, {
      upgradeType: 'maintainYarnLock',
    });
    upgrade.upgradeType = 'maintainYarnLock';
    upgrade.commitMessage = upgrade.yarnMaintenanceCommitMessage;
    upgrade.branchName = upgrade.yarnMaintenanceBranchName;
    upgrade.prTitle = upgrade.yarnMaintenancePrTitle;
    upgrade.prBody = upgrade.yarnMaintenancePrBody;
    upgrades.push(upgrade);
  }
  logger.info('Finished processing package file');
  return upgrades;
}

function getDepTypeConfig(packageFileConfig, depType) {
  let depTypeConfig = typeof depType === 'string' ? { depType } : depType;
  depTypeConfig = Object.assign({}, packageFileConfig, depTypeConfig);
  depTypeConfig.logger = logger.child({
    repository: depTypeConfig.repository,
    packageFile: depTypeConfig.packageFile,
    depType: depTypeConfig.depType,
  });
  return configParser.filterConfig(depTypeConfig, 'depType');
}
