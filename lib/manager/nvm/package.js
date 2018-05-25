const nodeManager = require('../_helpers/node/package');

module.exports = {
  getPackageUpdates,
};

function getPackageUpdates(config) {
  logger.debug('nvm.getPackageUpdates()');
  return nodeManager.getPackageUpdates(config);
}
