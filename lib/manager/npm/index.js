const { extractPackageFile, postExtract } = require('./extract');
const { updateDependency } = require('./update');
const { getRangeStrategy } = require('./range');

module.exports = {
  extractPackageFile,
  language: 'js',
  postExtract,
  getRangeStrategy,
  updateDependency,
  supportsLockFileMaintenance: true,
};
