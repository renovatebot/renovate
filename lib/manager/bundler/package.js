// const rubygems = require('../../datasource/rubygems');

module.exports = {
  getPackageUpdates,
};

function getPackageUpdates(config) {
  const { depName, depType, currentVersion, lockedVersion } = config;
  logger.debug({ depName, depType, currentVersion, lockedVersion });
  const upgrades = [];
  // TODO: Look up updates here, return array
  return upgrades;
}
