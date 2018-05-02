const { extractDependencies, correlateDependencies } = require('./extract');
const { getPackageUpdates } = require('./package');
const { resolvePackageFile } = require('./resolve');
const { updateDependency } = require('./update');

module.exports = {
  extractDependencies,
  correlateDependencies,
  getPackageUpdates,
  resolvePackageFile,
  updateDependency,
};
