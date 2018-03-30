const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('./package');
const { resolvePackageFile } = require('./resolve');
const { updateDependency } = require('./update');

const filePattern = new RegExp('^.nvmrc$');

module.exports = {
  extractDependencies,
  filePattern,
  getPackageUpdates,
  resolvePackageFile,
  updateDependency,
};
