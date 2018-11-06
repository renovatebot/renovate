const { extractPackageFile } = require('./extract');
const { updateDependency } = require('./update');

module.exports = {
  extractPackageFile,
  language: 'js',
  updateDependency,
};
