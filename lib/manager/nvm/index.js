const { extractPackageFile } = require('./extract');
const { updateDependency } = require('./update');

const language = 'node';

module.exports = {
  extractPackageFile,
  language,
  updateDependency,
};
