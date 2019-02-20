const { extractPackageFile } = require('./extract');
const { updateDependency } = require('../pip_requirements/update');

const language = 'python';

module.exports = {
  extractPackageFile,
  language,
  updateDependency,
};
