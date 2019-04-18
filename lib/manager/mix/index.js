const { extractPackageFile } = require('./extract');
const { updateDependency } = require('./update');
const { getArtifacts } = require('./artifacts');

const language = 'elixir';

module.exports = {
  extractPackageFile,
  getArtifacts,
  language,
  updateDependency,
};
