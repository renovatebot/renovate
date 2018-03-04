const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('./package');
const { resolvePackageFile } = require('./resolve');
const { setNewValue } = require('./update');

const filePattern = new RegExp('(^|/)WORKSPACE$');
const contentPattern = new RegExp('(^|\\n)git_repository\\(');

module.exports = {
  contentPattern,
  extractDependencies,
  filePattern,
  getPackageUpdates,
  resolvePackageFile,
  setNewValue,
};
