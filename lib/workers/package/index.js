const npmApi = require('../../api/npm');
const versions = require('./versions');
const configParser = require('../../config');

let logger = require('../../logger');

module.exports = {
  findUpgrades,
};

// Returns all results for a given dependency config
async function findUpgrades(config) {
  logger = config.logger || logger;
  if (config.enabled === false) {
    logger.debug('package is disabled');
    return [];
  }
  let results = [];
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
    logger.warn(result.message);
    results = [result];
  }
  logger.debug(`${config.depName} results: ${JSON.stringify(results)}`);
  // Flatten the result on top of config, add repositoryUrl
  return results.map(result => {
    const upg = configParser.mergeChildConfig(config, result);
    upg.repositoryUrl = npmDep ? npmDep.repositoryUrl : '';
    return configParser.filterConfig(upg, 'branch');
  });
}
