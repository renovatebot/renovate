const { extractPackageFile } = require('./extract');
const { updateDependency } = require('./update');

const language = 'elixir';

module.exports = {
  extractPackageFile,
  language,
  updateDependency,
};
