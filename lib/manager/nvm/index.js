const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('./package');
const { updateDependency } = require('./update');

const filePattern = new RegExp('^.nvmrc$');
const language = 'node';

module.exports = {
  extractDependencies,
  filePattern,
  getPackageUpdates,
  language,
  updateDependency,
};
