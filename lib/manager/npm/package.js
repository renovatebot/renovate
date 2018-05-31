const lookup = require('./lookup');

module.exports = {
  getPackageUpdates,
};

async function getPackageUpdates(config) {
  logger.debug({ config }, `npm.getPackageUpdates()`);
  const results = await lookup.lookupUpdates(config);
  return results;
}
