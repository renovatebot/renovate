const { detectPackageFiles } = require('./detect');
const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('../npm/package');
const { resolvePackageFile } = require('./resolve');
const { setNewValue } = require('./update');

module.exports = {
  detectPackageFiles,
  extractDependencies,
  getPackageUpdates,
  resolvePackageFile,
  setNewValue,
};
