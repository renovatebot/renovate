const configParser = require('../../config');
const pkgWorker = require('../package');
const { extractDependencies } = require('../../manager');

module.exports = {
  renovateDepType,
  getDepConfig,
};

async function renovateDepType(packageContent, config) {
  logger.setMeta({
    repository: config.repository,
    packageFile: config.packageFile,
    depType: config.depType,
  });
  logger.debug('renovateDepType()');
  logger.trace({ config });
  if (config.enabled === false) {
    logger.debug('depType is disabled');
    return [];
  }
  let deps = await extractDependencies(packageContent, config);
  if (config.lerna || config.workspaces || config.workspaceDir) {
    deps = deps.filter(
      dependency => config.monorepoPackages.indexOf(dependency.depName) === -1
    );
  }
  deps = deps.filter(
    dependency => config.ignoreDeps.indexOf(dependency.depName) === -1
  );
  logger.debug(`filtered deps length is ${deps.length}`);
  logger.debug({ deps }, `filtered deps`);
  // Obtain full config for each dependency
  const depConfigs = deps.map(dep => module.exports.getDepConfig(config, dep));
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
  const { depName: dependency } = dep;
  let depConfig = configParser.mergeChildConfig(depTypeConfig, dep);
  // Apply any matching package rules
  if (depConfig.packageRules) {
    logger.trace(
      { dependency, packageRules: depConfig.packageRules },
      `Checking against ${depConfig.packageRules.length} packageRules`
    );
    depConfig.packageRules.forEach(packageRule => {
      const {
        excludePackageNames,
        excludePackagePatterns,
        packageNames,
        packagePatterns,
      } = packageRule;
      let applyRule = false;
      if (
        (excludePackageNames || excludePackagePatterns) &&
        !(packageNames || packagePatterns)
      ) {
        logger.debug(
          { packageRule, dependency },
          'packageRule is missing packageNames and packagePatterns so will match anything'
        );
        applyRule = true;
      } else if (packageNames && packageNames.includes(dependency)) {
        logger.debug({ dependency, packageNames }, 'Matched packageNames');
        applyRule = true;
      } else if (packagePatterns) {
        logger.trace({ dependency }, 'Checking against packagePatterns');
        for (const packagePattern of packagePatterns) {
          const packageRegex = new RegExp(
            packagePattern === '^*$' || packagePattern === '*'
              ? '.*'
              : packagePattern
          );
          logger.trace(
            { dependency, packagePattern },
            'Checking against packagePattern'
          );
          if (dependency.match(packageRegex)) {
            logger.debug(`${dependency} matches against ${packageRegex}`);
            applyRule = true;
          }
        }
      }
      if (excludePackageNames && excludePackageNames.includes(dependency)) {
        applyRule = false;
      } else if (excludePackagePatterns) {
        for (const packagePattern of excludePackagePatterns) {
          const packageRegex = new RegExp(packagePattern);
          if (dependency.match(packageRegex)) {
            applyRule = false;
          }
        }
      }
      if (applyRule) {
        // Package rule config overrides any existing config
        depConfig = configParser.mergeChildConfig(depConfig, packageRule);
        delete depConfig.packageNames;
        delete depConfig.packagePatterns;
        delete depConfig.excludePackageNames;
        delete depConfig.excludePackagePatterns;
      }
    });
  }
  return configParser.filterConfig(depConfig, 'package');
}
