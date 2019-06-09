const { extractPackageFile } = require('./extract');
const { updateDependency } = require('../npm/update');
const { createArtifacts, updateArtifacts } = require('./artifacts');
const { getRangeStrategy } = require('./range');

const language = 'php';

module.exports = {
  extractPackageFile,
  createArtifacts,
  updateArtifacts,
  language,
  updateDependency,
  getRangeStrategy,
};
