const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('../docker/package');
const { resolvePackageFile } = require('./resolve');
const { setNewValue } = require('./update');

const filePattern = new RegExp('^.gitlab-ci.yml$');
const contentPattern = new RegExp('(^|\\n)\\s*(image|services): ');

module.exports = {
  contentPattern,
  extractDependencies,
  filePattern,
  getPackageUpdates,
  resolvePackageFile,
  setNewValue,
};
