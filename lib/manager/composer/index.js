const { extractDependencies } = require('./extract');
const { updateDependency } = require('../npm/update');
const { getArtifacts } = require('./artifacts');

const language = 'php';

module.exports = {
  extractDependencies,
  getArtifacts,
  language,
  updateDependency,
  // TODO: support this
  // supportsLockFileMaintenance: true,
};
