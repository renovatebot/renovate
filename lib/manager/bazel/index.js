const { extractDependencies } = require('./extract');
const { updateDependency } = require('./update');

const contentPattern = new RegExp('(^|\\n)git_repository\\(');

module.exports = {
  contentPattern,
  extractDependencies,
  updateDependency,
};
