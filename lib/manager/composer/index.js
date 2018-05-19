const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('./package');
const { updateDependency } = require('../npm/update');

const language = 'php';

module.exports = {
  extractDependencies,
  getPackageUpdates,
  language,
  updateDependency,
  // TODO: support this
  // supportsLockFileMaintenance: true,
};
