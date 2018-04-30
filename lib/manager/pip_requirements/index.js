const { packagePattern, extractDependencies } = require('./extract');
const { getPackageUpdates } = require('./package');
const { updateDependency } = require('./update');

const contentPattern = new RegExp(`^${packagePattern}==`);
const language = 'python';

module.exports = {
  contentPattern,
  extractDependencies,
  getPackageUpdates,
  language,
  updateDependency,
};
