const npmApi = require('../../api/npm');
const versions = require('./versions');

let logger = require('../../helpers/logger');

module.exports = {
  findDepUpgrades,
};

// Returns all upgrades for a given dependency config
async function findDepUpgrades(depConfig) {
  logger = depConfig.logger || logger;
  const npmDep = await npmApi.getDependency(depConfig.depName, logger);
  // If dependency lookup fails then warn and return
  if (!npmDep) {
    logger.warn(`Failed to look up dependency ${depConfig.depName}`);
    return [];
  }
  const upgrades = await versions.determineUpgrades(npmDep, depConfig);
  if (upgrades.length > 0) {
    logger.info(
      { dependency: depConfig.depName },
      `${upgrades.length} upgrade(s) available: ${upgrades.map(
        upgrade => upgrade.newVersion
      )}`
    );
  } else {
    logger.debug(`${depConfig.depName}: No upgrades required`);
  }
  // Flatten the config on top of upgrade
  return upgrades.map(upgrade => Object.assign({}, depConfig, upgrade));
}
