const { detectPackageFiles } = require('./detect');
const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('../npm/package');
const { resolvePackageFile } = require('./resolve');
const { setNewValue } = require('./update');

const filePattern = '(^|/)package.js$';

module.exports = {
  detectPackageFiles,
  extractDependencies,
  filePattern,
  getPackageUpdates,
  resolvePackageFile,
  setNewValue,
};
