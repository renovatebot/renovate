const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('./package');
const { updateDependency } = require('./update');

module.exports = {
  extractDependencies,
  getPackageUpdates,
  updateDependency,
};
