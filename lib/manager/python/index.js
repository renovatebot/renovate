const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('./package');
const { updateDependency } = require('./update');

const filePattern = new RegExp('^requirements.txt$');
const contentPattern = /^([a-z][-\w.]+)==/i;
const parentManager = 'node';

module.exports = {
  contentPattern,
  extractDependencies,
  filePattern,
  getPackageUpdates,
  parentManager,
  updateDependency,
};
