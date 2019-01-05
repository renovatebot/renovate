const semver = require('../../versioning/semver');

module.exports = {
  extractPackageFile,
};

function extractPackageFile(content) {
  const dep = {
    datasource: 'node',
    depName: 'node',
    lookupName: 'nodejs/node',
    currentValue: content.trim(),
  };
  if (!semver.isVersion(dep.currentValue)) {
    dep.skipReason = 'unsupported-version';
  }
  return { deps: [dep] };
}
