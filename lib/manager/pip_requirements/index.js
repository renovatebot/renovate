const { extractPackageFile } = require('./extract');
const { updateDependency } = require('./update');

const language = 'python';

module.exports = {
  extractPackageFile,
  language,
  updateDependency,
};
