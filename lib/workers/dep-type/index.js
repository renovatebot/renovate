const configParser = require('../../config');
const pkgWorker = require('../package');
const packageJson = require('./package-json');

module.exports = {
  renovateDepType,
  getDepConfig,
};

async function renovateDepType(packageContent, config) {
  const { logger } = config;
  logger.trace({ config }, `renovateDepType(packageContent, config)`);
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
  logger.debug(`currentDeps length is ${currentDeps.length}`);
  logger.debug({ currentDeps }, `currentDeps`);
  // Filter out ignored dependencies
  let filteredDeps = currentDeps.filter(
    dependency => config.ignoreDeps.indexOf(dependency.depName) === -1
  );
  if (config.lernaPackages) {
    filteredDeps = filteredDeps.filter(
      dependency => config.lernaPackages.indexOf(dependency.depName) === -1
    );
  }
  logger.debug(`filteredDeps length is ${filteredDeps.length}`);
  logger.debug({ filteredDeps }, `filteredDeps`);
  // Obtain full config for each dependency
  const depConfigs = filteredDeps.map(dep =>
    module.exports.getDepConfig(config, dep)
  );
  logger.trace({ config: depConfigs }, `depConfigs`);
  // renovateDepType can return more than one upgrade each
  const pkgWorkers = depConfigs.map(depConfig =>
    pkgWorker.renovatePackage(depConfig)
  );
  // Use Promise.all to execute npm queries in parallel
  const allUpgrades = await Promise.all(pkgWorkers);
  logger.trace({ config: allUpgrades }, `allUpgrades`);
  // Squash arrays into one
  const combinedUpgrades = [].concat(...allUpgrades);
  logger.trace({ config: combinedUpgrades }, `combinedUpgrades`);
  return combinedUpgrades;
}

function getDepConfig(depTypeConfig, dep) {
  const depConfig = configParser.mergeChildConfig(depTypeConfig, dep);
  // Apply any matching package rules
  if (depConfig.packageRules) {
    let packageRuleApplied = false;
    depConfig.packageRules.forEach(packageRule => {
      // Apply at most 1 package fule
      if (!packageRuleApplied) {
        if (
          packageRule.packageNames &&
          packageRule.packageNames.includes(depConfig.depName)
        ) {
          packageRuleApplied = true;
        } else if (packageRule.packagePatterns) {
          for (const packagePattern of packageRule.packagePatterns) {
            const packageRegex = new RegExp(packagePattern);
            if (depConfig.depName.match(packageRegex)) {
              packageRuleApplied = true;
            }
          }
        }
        if (
          packageRule.excludePackageNames &&
          packageRule.excludePackageNames.includes(depConfig.depName)
        ) {
          packageRuleApplied = false;
        } else if (packageRule.excludePackagePatterns) {
          for (const packagePattern of packageRule.excludePackagePatterns) {
            const packageRegex = new RegExp(packagePattern);
            if (depConfig.depName.match(packageRegex)) {
              packageRuleApplied = false;
            }
          }
        }
        if (packageRuleApplied) {
          // Package rule config overrides any existing config
          Object.assign(depConfig, packageRule);
          delete depConfig.packageNames;
          delete depConfig.packagePatterns;
        }
      }
    });
  }
  depConfig.logger = depTypeConfig.logger.child({
    repository: depConfig.repository,
    packageFile: depConfig.packageFile,
    depType: depConfig.depType,
    dependency: depConfig.depName,
  });
  return configParser.filterConfig(depConfig, 'package');
}
