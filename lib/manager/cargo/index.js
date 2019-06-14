const { extractPackageFile } = require('./extract');
const { updateDependency } = require('./update');
const { updateArtifacts } = require('./artifacts');

const language = 'rust';

module.exports = {
  extractPackageFile,
  updateArtifacts,
  language,
  updateDependency,
  // TODO: Support this
  supportsLockFileMaintenance: false,
};
