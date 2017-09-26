const npmApi = require('../../api/npm');
const versions = require('./versions');

module.exports = {
  renovateNpmPackage,
};

async function renovateNpmPackage(config) {
  const { logger } = config;
  let results = [];
  if (!versions.isValidVersion(config.currentVersion)) {
    results.push({
      depName: config.depName,
      type: 'warning',
      message: `Dependency uses tag "\`${config.currentVersion}\`" as its version so that will never be changed by Renovate`,
    });
    logger.debug(results[0].message);
    return results;
  }
  const npmDep = await npmApi.getDependency(config.depName, logger);
  if (npmDep) {
    results = await versions.determineUpgrades(npmDep, config);
    if (results.length > 0) {
      logger.info(
        { dependency: config.depName },
        `${results.length} result(s): ${results.map(
          upgrade => upgrade.newVersion
        )}`
      );
    }
  } else {
    // If dependency lookup fails then warn and return
    const result = {
      type: 'warning',
      message: 'Failed to look up dependency',
    };
    if (config.hasYarnLock || config.hasPackageLock) {
      result.message +=
        '. This will block *all* dependencies from being updated due to presence of lock file.';
    }
    results = [result];
    logger.info(result.message);
  }
  for (const result of results) {
    result.repositoryUrl =
      npmDep && npmDep.repositoryUrl && npmDep.repositoryUrl.length
        ? npmDep.repositoryUrl
        : null;
  }
  return results;
}
