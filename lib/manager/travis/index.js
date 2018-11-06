const { extractPackageFile } = require('./extract');
const { getPackageUpdates } = require('./package');
const { updateDependency } = require('./update');

const language = 'node';

module.exports = {
  extractPackageFile,
  getPackageUpdates,
  language,
  updateDependency,
};
