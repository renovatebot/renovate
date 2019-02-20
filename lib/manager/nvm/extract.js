const node = require('../../versioning/node');

module.exports = {
  extractPackageFile,
};

function extractPackageFile(content) {
  const dep = {
    depName: 'node',
    currentValue: content.trim(),
    purl: 'pkg:github/nodejs/node',
  };
  if (!node.isValid(dep.currentValue)) {
    dep.skipReason = 'unsupported-version';
  }
  return { deps: [dep] };
}
