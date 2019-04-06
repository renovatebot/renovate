const { extractAllPackageFiles } = require('./extract');
const { updateDependency } = require('./update');

module.exports = {
  extractAllPackageFiles,
  language: 'java',
  updateDependency,
};
