const { extractPackageFile } = require('./extract');
const { updateDependency } = require('../npm/update');
const { getArtifacts, createArtifacts } = require('./artifacts');
const { getRangeStrategy } = require('./range');

const language = 'php';

module.exports = {
  extractPackageFile,
  getArtifacts,
  createArtifacts,
  language,
  updateDependency,
  getRangeStrategy,
};
