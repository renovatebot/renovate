const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('./package');
const { updateDependency } = require('./update');

const filePattern = new RegExp('^.nvmrc$');
const parentManager = 'node';

module.exports = {
  extractDependencies,
  filePattern,
  getPackageUpdates,
  parentManager,
  updateDependency,
};
