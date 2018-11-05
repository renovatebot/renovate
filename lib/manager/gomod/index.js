const { extractPackageFile } = require('./extract');
const { updateDependency } = require('./update');
const { getArtifacts } = require('./artifacts');

module.exports = {
  extractPackageFile,
  updateDependency,
  getArtifacts,
  language: 'golang',
};
