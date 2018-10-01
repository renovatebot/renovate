const { extractDependencies } = require('./extract');
const { updateDependency } = require('./update');
const { getArtifacts } = require('./artifacts');

module.exports = {
  extractDependencies,
  updateDependency,
  getArtifacts,
  language: 'golang',
};
