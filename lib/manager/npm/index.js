const { extractDependencies, postExtract } = require('./extract');
const { updateDependency } = require('./update');

module.exports = {
  extractDependencies,
  postExtract,
  updateDependency,
  supportsLockFileMaintenance: true,
};
