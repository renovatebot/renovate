const npmApi = require('../../api/npm');
const versions = require('./versions');

let logger = require('../../helpers/logger');

module.exports = {
  findDepUpgrades,
};

async function findDepUpgrades(depConfig) {
  logger = depConfig.logger || logger;
  const npmDep = await npmApi.getDependency(depConfig.depName, logger);
  if (!npmDep) {
    logger.warn(`Failed to look up dependency ${depConfig.depName}`);
    // If dependency lookup fails then ignore it and return
    return [];
  }
  const upgrades = await versions.determineUpgrades(npmDep, depConfig);
  if (upgrades.length > 0) {
    logger.info(
      `Dependency ${depConfig.depName} has ${upgrades.length} upgrade(s) available: ${upgrades.map(
        upgrade => upgrade.newVersion
      )}`
    );
  } else {
    logger.debug(`${depConfig.depName}: No upgrades required`);
  }
  return upgrades.map(upgrade => Object.assign({}, depConfig, upgrade));
}
