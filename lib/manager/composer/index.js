const { extractDependencies } = require('./extract');
const { updateDependency } = require('../npm/update');

const language = 'php';

module.exports = {
  extractDependencies,
  language,
  updateDependency,
  // TODO: support this
  // supportsLockFileMaintenance: true,
};
