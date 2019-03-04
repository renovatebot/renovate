const { extractPackageFile } = require('./extract');
const { updateDependency } = require('./update');
const { getArtifacts } = require('./artifacts');

const language = 'rust';

module.exports = {
  extractPackageFile,
  getArtifacts,
  language,
  updateDependency,
  // TODO: Support this
  supportsLockFileMaintenance: false,
};
