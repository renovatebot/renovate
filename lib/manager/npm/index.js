const { extractAllFiles } = require('./extract');
const { updateDependency } = require('./update');
const { getRangeStrategy } = require('./range');

module.exports = {
  extractAllFiles,
  language: 'js',
  getRangeStrategy,
  updateDependency,
  supportsLockFileMaintenance: true,
};
