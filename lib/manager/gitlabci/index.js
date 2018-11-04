const { extractPackageFile } = require('./extract');
const { updateDependency } = require('./update');

const language = 'docker';

module.exports = {
  extractPackageFile,
  language,
  updateDependency,
};
