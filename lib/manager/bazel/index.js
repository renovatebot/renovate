const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('./package');
const { updateDependency } = require('./update');

const filePattern = new RegExp('(^|/)WORKSPACE$');
const contentPattern = new RegExp('(^|\\n)git_repository\\(');

module.exports = {
  contentPattern,
  extractDependencies,
  filePattern,
  getPackageUpdates,
  updateDependency,
};
