const docker = require('./docker/package');
const npm = require('./npm/package');

module.exports = {
  getPackageUpdates,
};

async function getPackageUpdates(config) {
  if (config.packageFile.endsWith('Dockerfile')) {
    return docker.getPackageUpdates(config);
  } else if (config.packageFile.endsWith('package.json')) {
    return npm.getPackageUpdates(config);
  } else if (config.packageFile.endsWith('package.js')) {
    return npm.getPackageUpdates(config);
  }
  config.logger.info(`Cannot find manager for ${config.packageFile}`);
  throw new Error('Unsupported package manager');
}
