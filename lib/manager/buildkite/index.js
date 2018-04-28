const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('./package');
const { updateDependency } = require('./update');

const filePattern = new RegExp('\\.buildkite/.+\\.yml$');

module.exports = {
  extractDependencies,
  filePattern,
  getPackageUpdates,
  updateDependency,
};
