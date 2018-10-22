const { extractDependencies } = require('./extract');
const { updateDependency } = require('./update');
const { getArtifacts } = require('./artifacts');

const language = 'python';

module.exports = {
  extractDependencies,
  updateDependency,
  getArtifacts,
  language,
};
