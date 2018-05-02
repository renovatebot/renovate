const { extractDependencies, postExtract } = require('./extract');
const { getPackageUpdates } = require('./package');
const { resolvePackageFile } = require('./resolve');
const { updateDependency } = require('./update');

module.exports = {
  extractDependencies,
  postExtract,
  getPackageUpdates,
  resolvePackageFile,
  updateDependency,
};
