const { extractDependencies } = require('./extract');
const { updateDependency } = require('./update');
const { getLockFile } = require('./lock-file');

module.exports = {
  extractDependencies,
  updateDependency,
  getLockFile,
  language: 'go',
};
