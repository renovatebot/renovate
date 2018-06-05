const { packagePattern, extractDependencies } = require('./extract');
const { updateDependency } = require('./update');

const contentPattern = new RegExp(`^${packagePattern}==`);
const language = 'python';

module.exports = {
  contentPattern,
  extractDependencies,
  language,
  updateDependency,
};
