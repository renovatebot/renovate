const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('./package');
const { resolvePackageFile } = require('./resolve');
const { updateDependency } = require('./update');

module.exports = {
  extractDependencies,
  getPackageUpdates,
  resolvePackageFile,
  updateDependency,
};
