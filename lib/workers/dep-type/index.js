const configParser = require('../../config');
const depWorker = require('../dependency');
const packageJson = require('./package-json');
let logger = require('../../helpers/logger');

module.exports = {
  findUpgrades,
};

async function findUpgrades(packageContent, config) {
  logger = config.logger || logger;
  logger.trace(
    `findUpgrades(${JSON.stringify(packageContent)}, ${JSON.stringify(config)})`
  );
  // Extract all dependencies from the package.json
  const currentDeps = await packageJson.extractDependencies(
    packageContent,
    config.depType
  );
  logger.debug(`currentDeps=${JSON.stringify(currentDeps)}`);
  // Filter out ignored dependencies
  const filteredDeps = currentDeps.filter(
    dependency => config.ignoreDeps.indexOf(dependency.depName) === -1
  );
  logger.debug(`filteredDeps=${JSON.stringify(filteredDeps)}`);
  // Obtain full config for each dependency
  const depConfigs = filteredDeps.map(dep =>
    configParser.getDepConfig(config, dep)
  );
  logger.debug(`depConfigs=${JSON.stringify(depConfigs)}`);
  // findDepUpgrades can return more than one upgrade each
  const depWorkers = depConfigs.map(depConfig =>
    depWorker.findDepUpgrades(depConfig)
  );
  // Use Promise.all to execute npm queries in parallel
  const allUpgrades = await Promise.all(depWorkers);
  logger.debug(`allUpgrades=${JSON.stringify(allUpgrades)}`);
  // Squash arrays into one
  const combinedUpgrades = [].concat(...allUpgrades);
  logger.debug(`combinedUpgrades=${JSON.stringify(combinedUpgrades)}`);
  return combinedUpgrades;
}
