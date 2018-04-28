const { packagePattern, extractDependencies } = require('./extract');
const { getPackageUpdates } = require('./package');
const { updateDependency } = require('./update');

const filePattern = /(^|\/)([\w-]*)requirements.(txt|pip)$/;
const contentPattern = new RegExp(`^${packagePattern}==`);
const parentManager = 'python';

module.exports = {
  contentPattern,
  extractDependencies,
  filePattern,
  getPackageUpdates,
  parentManager,
  updateDependency,
};
