const configParser = require('../../config');
const { renovateDockerImage } = require('./docker');
const { renovateNpmPackage } = require('./npm');

module.exports = {
  renovatePackage,
};

// Returns all results for a given dependency config
async function renovatePackage(config) {
  const { logger } = config;
  logger.trace({ config }, `renovatePackage(${config.depName})`);
  if (config.enabled === false) {
    logger.debug('package is disabled');
    return [];
  }
  let results;
  if (config.depType === 'Dockerfile') {
    results = await renovateDockerImage(config);
  } else {
    // npm
    results = await renovateNpmPackage(config);
  }
  logger.debug({ results }, `${config.depName} lookup results`);
  // Flatten the result on top of config, add repositoryUrl
  return (
    results
      // combine upgrade fields with existing config
      .map(res => configParser.mergeChildConfig(config, res))
      // type can be major, minor, patch, pin, digest
      .map(res => configParser.mergeChildConfig(res, res[res.type]))
      // allow types to be disabled
      .filter(res => res.enabled)
      // strip unnecessary fields for next stage
      .map(res => configParser.filterConfig(res, 'branch'))
  );
}
