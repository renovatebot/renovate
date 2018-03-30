const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('../docker/package');
const { updateDependency } = require('./update');

const filePattern = new RegExp('^.gitlab-ci.yml$');
const contentPattern = new RegExp('(^|\\n)\\s*(image|services): ');
const parentManager = 'docker';

module.exports = {
  contentPattern,
  extractDependencies,
  filePattern,
  getPackageUpdates,
  parentManager,
  updateDependency,
};
