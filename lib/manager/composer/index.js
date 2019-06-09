const { extractPackageFile } = require('./extract');
const { updateDependency } = require('../npm/update');
const { updateArtifacts, createArtifacts } = require('./artifacts');
const { getRangeStrategy } = require('./range');

const language = 'php';

module.exports = {
  extractPackageFile,
  updateArtifacts,
  language,
  updateDependency,
  getRangeStrategy,
};
