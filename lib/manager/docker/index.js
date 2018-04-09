const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('./package');
const { resolvePackageFile } = require('./resolve');
const { updateDependency } = require('./update');

const filePattern = new RegExp('(^|/)Dockerfile$');
const contentPattern = new RegExp('(^|\\n)FROM .+\\n', 'i');

module.exports = {
  contentPattern,
  extractDependencies,
  filePattern,
  getPackageUpdates,
  resolvePackageFile,
  updateDependency,
};
