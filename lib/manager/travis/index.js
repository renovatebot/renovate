const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('./package');
const { updateDependency } = require('./update');

const contentPattern = new RegExp('(^|\\n)node_js:\\n');
const language = 'node';

module.exports = {
  contentPattern,
  extractDependencies,
  getPackageUpdates,
  language,
  updateDependency,
};
