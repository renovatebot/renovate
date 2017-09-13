const npmApi = require('../../api/npm');
const versions = require('./versions');
const configParser = require('../../config');

const pLogger = require('../../logger');

module.exports = {
  renovatePackage,
};

// Returns all results for a given dependency config
async function renovatePackage(config) {
  const logger = config.logger || pLogger;
  logger.trace(`renovatePackage(${config.depName})`);
  if (config.enabled === false) {
    logger.debug('package is disabled');
    return [];
  }
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
      type: 'error',
      message: 'Failed to look up dependency',
    };
    if (config.hasYarnLock || config.hasPackageLock) {
      result.message +=
        '. This will block *all* dependencies from being updated due to presence of lock file.';
    }
    results = [result];
    logger.warn(result.message);
  }
  logger.debug({ results }, `${config.depName} lookup results`);
  // Flatten the result on top of config, add repositoryUrl
  return results.map(result => {
    let upg = configParser.mergeChildConfig(config, result);
    upg.repositoryUrl =
      npmDep && npmDep.repositoryUrl && npmDep.repositoryUrl.length
        ? npmDep.repositoryUrl
        : null;
    // type should be major, minor, patch, pin or digest
    upg = configParser.mergeChildConfig(upg, upg[upg.type]);
    return configParser.filterConfig(upg, 'branch');
  });
}
