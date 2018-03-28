const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('../docker/package');
const { resolvePackageFile } = require('./resolve');
const { setNewValue } = require('./update');

const filePattern = new RegExp('(^|/)docker-compose[^/]*\\.ya?ml$');
const contentPattern = new RegExp('(^|\\n)\\s*image:');

module.exports = {
  contentPattern,
  extractDependencies,
  filePattern,
  getPackageUpdates,
  resolvePackageFile,
  setNewValue,
};
