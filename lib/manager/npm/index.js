const { extractDependencies, postExtract } = require('./extract');
const { getPackageUpdates } = require('./package');
const { updateDependency } = require('./update');

module.exports = {
  extractDependencies,
  postExtract,
  getPackageUpdates,
  updateDependency,
  supportsLockFileMaintenance: true,
};
