const npmApi = require('../../api/npm');
const versions = require('./versions');

module.exports = {
  findUpgrades,
};

async function findUpgrades(depConfigs) {
  const allUpgrades = [];
  // findDepUpgrades can add more than one upgrade to allUpgrades
  async function findDepUpgrades(dep) {
    const npmDependency = await npmApi.getDependency(dep.depName, dep.logger);
    if (!npmDependency) {
      // If dependency lookup fails then ignore it and keep going
      return;
    }
    const upgrades = await versions.determineUpgrades(npmDependency, dep);
    if (upgrades.length > 0) {
      dep.logger.info(
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
      dep.logger.debug(`${dep.depName}: No upgrades required`);
    }
  }
  const promiseArray = depConfigs.map(dep => findDepUpgrades(dep));
  // Use Promise.all to execute npm queries in parallel
  await Promise.all(promiseArray);
  // Return the upgrade array once all Promises are complete
  return allUpgrades;
}
