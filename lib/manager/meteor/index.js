const { extractDependencies } = require('./extract');
const { updateDependency } = require('./update');

const contentPattern = new RegExp('(^|\\n)\\s*Npm.depends\\(\\s*{');

module.exports = {
  contentPattern,
  extractDependencies,
  updateDependency,
};
