const configParser = require('../../config');
const pkgWorker = require('../package');
const packageJson = require('./package-json');
let logger = require('../../logger');

module.exports = {
  findUpgrades,
  getDepConfig,
};

async function findUpgrades(packageContent, config) {
  logger = config.logger || logger;
  logger.trace(
    `findUpgrades(${JSON.stringify(packageContent)}, ${JSON.stringify(config)})`
  );
  if (config.enabled === false) {
    logger.debug('depType is disabled');
    return [];
  }
  // Extract all dependencies from the package.json
  const currentDeps = await packageJson.extractDependencies(
    packageContent,
    config.depType
  );
  if (currentDeps.length === 0) {
    return [];
  }
  logger.debug(`currentDeps=${JSON.stringify(currentDeps)}`);
  // Filter out ignored dependencies
  const filteredDeps = currentDeps.filter(
    dependency => config.ignoreDeps.indexOf(dependency.depName) === -1
  );
  logger.debug(`filteredDeps=${JSON.stringify(filteredDeps)}`);
  // Obtain full config for each dependency
  const depConfigs = filteredDeps.map(dep =>
    module.exports.getDepConfig(config, dep)
  );
  logger.debug(`depConfigs=${JSON.stringify(depConfigs)}`);
  // findUpgrades can return more than one upgrade each
  const pkgWorkers = depConfigs.map(depConfig =>
    pkgWorker.findUpgrades(depConfig)
  );
  // Use Promise.all to execute npm queries in parallel
  const allUpgrades = await Promise.all(pkgWorkers);
  logger.debug(`allUpgrades=${JSON.stringify(allUpgrades)}`);
  // Squash arrays into one
  const combinedUpgrades = [].concat(...allUpgrades);
  logger.debug(`combinedUpgrades=${JSON.stringify(combinedUpgrades)}`);
  return combinedUpgrades;
}

function getDepConfig(depTypeConfig, dep) {
  const depConfig = Object.assign({}, depTypeConfig, dep);
  // Apply any matching package rules
  if (depConfig.packages) {
    let packageRuleApplied = false;
    depConfig.packages.forEach(packageConfig => {
      // Apply at most 1 package fule
      if (!packageRuleApplied) {
        const pattern =
          packageConfig.packagePattern || `^${packageConfig.packageName}$`;
        const packageRegex = new RegExp(pattern);
        if (depConfig.depName.match(packageRegex)) {
          packageRuleApplied = true;
          // Package rule config overrides any existing config
          Object.assign(depConfig, packageConfig);
          delete depConfig.packageName;
          delete depConfig.packagePattern;
        }
      }
    });
  }
  depConfig.logger = logger.child({
    repository: depConfig.repository,
    packageFile: depConfig.packageFile,
    depType: depConfig.depType,
    dependency: depConfig.depName,
  });
  return configParser.filterConfig(depConfig, 'package');
}
