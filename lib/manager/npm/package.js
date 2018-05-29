const npmApi = require('../../datasource/npm');
const lookup = require('./lookup');
const nodeManager = require('../_helpers/node/package');

module.exports = {
  getPackageUpdates,
};

async function getPackageUpdates(config) {
  logger.trace({ config }, `npm.getPackageUpdates()`);
  const { depType, depName } = config;
  if (depType === 'engines') {
    if (depName !== 'node') {
      logger.debug('Skipping non-node engine');
      return [];
    }
    return nodeManager.getPackageUpdates(config);
  }
  let results = [];
  npmApi.setNpmrc(
    config.npmrc,
    config.global ? config.global.exposeEnv : false
  );
  results = await lookup.lookupUpdates(config);
  return results;
}
