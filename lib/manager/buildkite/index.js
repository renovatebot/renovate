const { extractDependencies } = require('./extract');
const { getPackageUpdates } = require('./package');
const { updateDependency } = require('./update');

// TODO: should we really look for `pipeline.yml` *anywhere* ?
const filePattern = new RegExp('(^|/)pipeline.yml$');

module.exports = {
  extractDependencies,
  filePattern,
  getPackageUpdates,
  updateDependency,
};
