const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('../docker/package');
const { updateDependency } = require('./update');

const language = 'docker';

module.exports = {
  extractDependencies,
  getPackageUpdates,
  language,
  updateDependency,
};
