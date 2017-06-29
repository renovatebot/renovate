const npmApi = require('../../api/npm');
const versions = require('./versions');

let logger = require('../../logger');

module.exports = {
  findUpgrades,
};

// Returns all upgrades for a given dependency config
async function findUpgrades(config) {
  logger = config.logger || logger;
  const npmDep = await npmApi.getDependency(config.depName, logger);
  // If dependency lookup fails then warn and return
  if (!npmDep) {
    logger.warn(`Failed to look up dependency ${config.depName}`);
    return [];
  }
  const upgrades = await versions.determineUpgrades(npmDep, config);
  if (upgrades.length > 0) {
    logger.info(
      { dependency: config.depName },
      `${upgrades.length} upgrade(s) available: ${upgrades.map(
        upgrade => upgrade.newVersion
      )}`
    );
  } else {
    logger.debug(`${config.depName}: No upgrades required`);
  }
  // Flatten the upgrade on top of config, add repositoryUrl
  return upgrades.map(upgrade =>
    Object.assign({}, config, upgrade, { repositoryUrl: npmDep.repositoryUrl })
  );
}
