const npmApi = require('../../api/npm');
const versions = require('./versions');

let logger = require('../../helpers/logger');

module.exports = {
  findDepUpgrades,
};

async function findDepUpgrades(dep) {
  logger = dep.logger || logger;
  const npmDependency = await npmApi.getDependency(dep.depName, logger);
  if (!npmDependency) {
    // If dependency lookup fails then ignore it and keep going
    return [];
  }
  const upgrades = await versions.determineUpgrades(
    npmDependency,
    dep.currentVersion,
    dep.config
  );
  const allUpgrades = [];
  if (upgrades.length > 0) {
    logger.info(
      `Dependency ${dep.depName} has ${upgrades.length} upgrade(s) available: ${upgrades.map(
        upgrade => upgrade.newVersion
      )}`
    );
    upgrades.forEach(upgrade => {
      const upgradeObj = Object.assign({}, dep, dep.config, upgrade);
      delete upgradeObj.config;
      allUpgrades.push(upgradeObj);
    });
  } else {
    logger.debug(`${dep.depName}: No upgrades required`);
  }
  return allUpgrades;
}
