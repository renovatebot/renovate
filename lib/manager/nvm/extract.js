const node = require('../../versioning/node');

module.exports = {
  extractPackageFile,
};

function extractPackageFile(content) {
  const dep = {
    depName: 'node',
    currentValue: content.trim(),
    datasource: 'github',
    lookupName: 'nodejs/node',
  };
  if (!node.isValid(dep.currentValue)) {
    dep.skipReason = 'unsupported-version';
  }
  return { deps: [dep] };
}
