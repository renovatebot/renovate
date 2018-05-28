const npmApi = require('../../datasource/npm');
const lookup = require('./lookup');
const { isValid } = require('../../versioning/semver');
const nodeManager = require('../_helpers/node/package');
const { parseRange } = require('semver-utils');

module.exports = {
  getRangeStrategy,
  getPackageUpdates,
};

function getRangeStrategy(config) {
  const {
    depType,
    depName,
    packageJsonType,
    currentVersion,
    rangeStrategy,
  } = config;
  const isComplexRange = parseRange(currentVersion).length > 1;
  if (rangeStrategy === 'bump' && isComplexRange) {
    logger.info(
      { currentVersion },
      'Replacing bump strategy for complex range with widen'
    );
    return 'widen';
  }
  if (rangeStrategy !== 'auto') {
    return rangeStrategy;
  }
  if (depType === 'devDependencies') {
    // Always pin devDependencies
    logger.debug({ depName }, 'Pinning devDependency');
    return 'pin';
  }
  if (depType === 'dependencies' && packageJsonType === 'app') {
    // Pin dependencies if we're pretty sure it's not a browser library
    logger.debug('Pinning app dependency');
    return 'pin';
  }
  if (depType === 'peerDependencies') {
    // Widen peer dependencies
    logger.debug('Widening peer dependencies');
    return 'widen';
  }
  if (isComplexRange) {
    return 'widen';
  }
  return 'replace';
}

async function getPackageUpdates(config) {
  logger.trace({ config }, `npm.getPackageUpdates()`);
  const { depType, depName, currentVersion } = config;
  if (depType === 'engines') {
    if (depName !== 'node') {
      logger.debug('Skipping non-node engine');
      return [];
    }
    return nodeManager.getPackageUpdates(config);
  }
  let results = [];
  if (currentVersion.startsWith('file:')) {
    logger.debug(
      { dependency: depName, currentVersion },
      'Skipping file: dependency'
    );
    return [];
  }
  if (!isValid(currentVersion)) {
    results.push({
      depName,
      type: 'warning',
      message: `Dependency uses tag "\`${currentVersion}\`" as its version so that will never be changed by Renovate`,
    });
    logger.debug(results[0].message);
    return results;
  }
  const rangeStrategy = getRangeStrategy(config);
  npmApi.setNpmrc(
    config.npmrc,
    config.global ? config.global.exposeEnv : false
  );
  const npmDep = await npmApi.getDependency(depName);
  if (npmDep) {
    results = lookup.lookupUpdates(npmDep, {
      ...config,
      rangeStrategy,
    });
    if (results.length > 0) {
      logger.info(
        { dependency: depName },
        `${results.length} result(s): ${results.map(
          upgrade => upgrade.newVersion
        )}`
      );
    }
  } else {
    // If dependency lookup fails then warn and return
    const result = {
      type: 'warning',
      message: `Failed to look up dependency ${depName}`,
    };
    results = [result];
    logger.info(
      { dependency: depName, packageFile: config.packageFile },
      result.message
    );
  }
  for (const result of results) {
    result.repositoryUrl =
      npmDep && npmDep.repositoryUrl && npmDep.repositoryUrl.length
        ? npmDep.repositoryUrl
        : null;
    if (!result.repositoryUrl && depName.startsWith('@types/')) {
      logger.debug('Setting @types url manually');
      result.repositoryUrl = `https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/${depName.replace(
        '@',
        ''
      )}`;
    }
  }
  return results;
}
