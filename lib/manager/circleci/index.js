const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('../docker/package');
const { updateDependency } = require('./update');

const contentPattern = new RegExp('(^|\\n)\\s*- image: ');
const language = 'docker';

module.exports = {
  contentPattern,
  extractDependencies,
  getPackageUpdates,
  language,
  updateDependency,
};
