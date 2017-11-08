const configParser = require('../../config');
const { getPackageUpdates } = require('../../manager');

module.exports = {
  renovatePackage,
};

// Returns all results for a given dependency config
async function renovatePackage(config) {
  // These are done in parallel so we don't setMeta to avoid conflicts
  logger.trace(
    { dependency: config.depName, config },
    `renovatePackage(${config.depName})`
  );
  if (config.enabled === false) {
    logger.debug('package is disabled');
    return [];
  }
  const results = await getPackageUpdates(config);
  logger.debug(
    { dependency: config.depName, results },
    `${config.depName} lookup results`
  );
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
