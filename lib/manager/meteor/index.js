const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('../npm/package');
const { resolvePackageFile } = require('./resolve');
const { setNewValue } = require('./update');

const filePattern = new RegExp('(^|/)package.js$');
const contentPattern = new RegExp('(^|\\n)\\s*Npm.depends\\(\\s*{');

module.exports = {
  contentPattern,
  extractDependencies,
  filePattern,
  getPackageUpdates,
  resolvePackageFile,
  setNewValue,
};
