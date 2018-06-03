const { extractDependencies, postExtract } = require('./extract');
const { updateDependency } = require('./update');
const { getRangeStrategy } = require('./range');

module.exports = {
  extractDependencies,
  postExtract,
  getRangeStrategy,
  updateDependency,
  supportsLockFileMaintenance: true,
};
