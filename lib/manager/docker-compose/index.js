const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('../docker/package');
const { resolvePackageFile } = require('./resolve');
const { updateDependency } = require('./update');

const filePattern = new RegExp('(^|/)docker-compose[^/]*\\.ya?ml$');
const contentPattern = new RegExp('(^|\\n)\\s*image:');
const parentManager = 'docker';

module.exports = {
  contentPattern,
  extractDependencies,
  filePattern,
  getPackageUpdates,
  parentManager,
  resolvePackageFile,
  updateDependency,
};
