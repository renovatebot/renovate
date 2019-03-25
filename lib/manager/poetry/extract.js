const semver = require('../../versioning/poetry');

module.exports = {
  extractPackageFile,
};

function extractPackageFile(content, fileName) {
  logger.trace(`poetry.extractPackageFile(${fileName})`);
  const deps = [];
  return { deps };
}
