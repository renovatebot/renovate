const { extractDependencies } = require('./extract');
const { updateDependency } = require('../npm/update');
const { getArtifacts } = require('./artifacts');
const { getRangeStrategy } = require('./range');

const language = 'php';

module.exports = {
  extractDependencies,
  getArtifacts,
  language,
  updateDependency,
  getRangeStrategy,
  // TODO: support this
  // supportsLockFileMaintenance: true,
};
