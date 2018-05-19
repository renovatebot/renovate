
module.exports = {
  getPackageUpdates,
};
const packagist = require('../../datasource/packagist');
const versions = require('../npm/versions');
const { isValidSemver } = require('../../util/semver');

module.exports = {
  getPackageUpdates,
};

async function getPackageUpdates(config) {
  logger.trace({ config }, `composer.getPackageUpdates()`);
  const { depName, currentVersion } = config;
  let results = [];
  if (currentVersion.startsWith('dev-') || currentVersion.endsWith('-dev')) {
    logger.debug(
      { dependency: depName, currentVersion },
      'Skipping branch: ' + currentVersion
    );
    return [];
  }
  if (!isValidSemver(currentVersion)) {
    results.push({
      depName,
      type: 'warning',
      message: `Dependency uses tag "\`${currentVersion}\`" as its version so that will never be changed by Renovate`,
    });
    logger.debug(results[0].message);
    return results;
  }
  const dep = await packagist.getDependency(depName);
  if (dep) {
    results = await versions.determineUpgrades(dep, {...dep, ...config});
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
  return results;
}
