const { extractPackageFile } = require('./extract');
const { updateDependency } = require('./update');

const language = 'ruby';

module.exports = {
  extractPackageFile,
  language,
  updateDependency,
};
