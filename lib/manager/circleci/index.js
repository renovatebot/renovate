const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('../docker/package');
const { updateDependency } = require('./update');

const filePattern = new RegExp('^.circleci/config.yml$');
const contentPattern = new RegExp('(^|\\n)\\s*- image: ');
const parentManager = 'docker';

module.exports = {
  contentPattern,
  extractDependencies,
  filePattern,
  getPackageUpdates,
  parentManager,
  updateDependency,
};
