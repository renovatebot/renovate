const { extractPackageFile } = require('./extract');
const { updateDependency } = require('./update');
const { updateArtifacts } = require('./artifacts');

module.exports = {
  extractPackageFile,
  updateDependency,
  updateArtifacts,
  language: 'golang',
};
