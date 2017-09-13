const configParser = require('../../config');
const { renovateNpmPackage } = require('./npm');

module.exports = {
  renovatePackage,
};

// Returns all results for a given dependency config
async function renovatePackage(config) {
  const logger = config.logger;
  logger.trace(`renovatePackage(${config.depName})`);
  if (config.enabled === false) {
    logger.debug('package is disabled');
    return [];
  }
  // npm
  const results = await renovateNpmPackage(config);
  logger.debug({ results }, `${config.depName} lookup results`);
  // Flatten the result on top of config, add repositoryUrl
  return results.map(result => {
    let upg = configParser.mergeChildConfig(config, result);
    // type should be major, minor, patch, pin or digest
    upg = configParser.mergeChildConfig(upg, upg[upg.type]);
    return configParser.filterConfig(upg, 'branch');
  });
}
