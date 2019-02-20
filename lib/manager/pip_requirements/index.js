const { extractPackageFile } = require('./extract');
const { updateDependency } = require('./update');
const { getRangeStrategy } = require('./range');

const language = 'python';

module.exports = {
  extractPackageFile,
  getRangeStrategy,
  language,
  updateDependency,
};
