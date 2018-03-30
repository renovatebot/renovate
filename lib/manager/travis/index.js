const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('./package');
const { updateDependency } = require('./update');

const filePattern = new RegExp('^.travis.yml$');
const contentPattern = new RegExp('(^|\\n)node_js:\\n');
const parentManager = 'node';

module.exports = {
  contentPattern,
  extractDependencies,
  filePattern,
  getPackageUpdates,
  parentManager,
  updateDependency,
};
