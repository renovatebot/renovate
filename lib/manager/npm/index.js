const { extractAllPackageFiles } = require('./extract');
const { updateDependency } = require('./update');
const { getRangeStrategy } = require('./range');

module.exports = {
  extractAllPackageFiles,
  language: 'js',
  getRangeStrategy,
  updateDependency,
  supportsLockFileMaintenance: true,
};
