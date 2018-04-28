const minimatch = require('minimatch');
const configParser = require('../../config');
const pkgWorker = require('./package');
const { extractDependencies } = require('../../manager');
const { intersectsSemver } = require('../../util/semver');

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
  const { depName: dependency, packageFile } = dep;
  let depConfig = configParser.mergeChildConfig(depTypeConfig, dep);
  // Apply any matching package rules
  if (depConfig.packageRules) {
    logger.trace(
      { dependency, packageRules: depConfig.packageRules },
      `Checking against ${depConfig.packageRules.length} packageRules`
    );
    depConfig.packageRules.forEach(packageRule => {
      let {
        paths,
        depTypeList,
        packageNames,
        packagePatterns,
        excludePackageNames,
        excludePackagePatterns,
        matchCurrentVersion,
      } = packageRule;
      // Setting empty arrays simplifies our logic later
      paths = paths || [];
      depTypeList = depTypeList || [];
      packageNames = packageNames || [];
      packagePatterns = packagePatterns || [];
      excludePackageNames = excludePackageNames || [];
      excludePackagePatterns = excludePackagePatterns || [];
      matchCurrentVersion = matchCurrentVersion || null;
      let positiveMatch = false;
      let negativeMatch = false;
      // Massage a positive patterns patch if an exclude one is present
      if (
        (excludePackageNames.length || excludePackagePatterns.length) &&
        !(packageNames.length || packagePatterns.length)
      ) {
        packagePatterns = ['.*'];
      }
      if (paths.length) {
        const isMatch = paths.some(
          rulePath =>
            packageFile.includes(rulePath) || minimatch(packageFile, rulePath)
        );
        positiveMatch = positiveMatch || isMatch;
        negativeMatch = negativeMatch || !isMatch;
      }
      if (depTypeList.length) {
        const isMatch = depTypeList.includes(dep.depType);
        positiveMatch = positiveMatch || isMatch;
        negativeMatch = negativeMatch || !isMatch;
      }
      if (packageNames.length || packagePatterns.length) {
        let isMatch = packageNames.includes(dep.depName);
        // name match is "or" so we check patterns if we didn't match names
        if (!isMatch) {
          for (const packagePattern of packagePatterns) {
            const packageRegex = new RegExp(
              packagePattern === '^*$' || packagePattern === '*'
                ? '.*'
                : packagePattern
            );
            if (dependency.match(packageRegex)) {
              logger.trace(`${dependency} matches against ${packageRegex}`);
              isMatch = true;
            }
          }
        }
        positiveMatch = positiveMatch || isMatch;
        negativeMatch = negativeMatch || !isMatch;
      }
      if (excludePackageNames.length) {
        const isMatch = excludePackageNames.includes(dep.depName);
        negativeMatch = negativeMatch || isMatch;
        positiveMatch = positiveMatch || !isMatch;
      }
      if (excludePackagePatterns.length) {
        let isMatch = false;
        for (const pattern of excludePackagePatterns) {
          const packageRegex = new RegExp(
            pattern === '^*$' || pattern === '*' ? '.*' : pattern
          );
          if (dependency.match(packageRegex)) {
            logger.trace(`${dependency} matches against ${packageRegex}`);
            isMatch = true;
          }
        }
        negativeMatch = negativeMatch || isMatch;
        positiveMatch = positiveMatch || !isMatch;
      }
      if (matchCurrentVersion) {
        const isMatch = intersectsSemver(
          dep.currentVersion,
          matchCurrentVersion
        );
        positiveMatch = positiveMatch || isMatch;
        negativeMatch = negativeMatch || !isMatch;
      }
      // This rule is considered matched if there was at least one positive match and no negative matches
      if (positiveMatch && !negativeMatch) {
        // Package rule config overrides any existing config
        depConfig = configParser.mergeChildConfig(depConfig, packageRule);
        delete depConfig.packageNames;
        delete depConfig.packagePatterns;
        delete depConfig.excludePackageNames;
        delete depConfig.excludePackagePatterns;
        delete depConfig.depTypeList;
        delete depConfig.matchCurrentVersion;
      }
    });
  }
  return configParser.filterConfig(depConfig, 'package');
}
