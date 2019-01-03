const semver = require('../../versioning/npm');

module.exports = {
  extractPackageFile,
};

function extractPackageFile(content) {
  const dep = {
    depName: 'node',
    currentValue: content.trim(),
    purl: 'pkg:github/nodejs/node?normalize=true',
  };
  if (!semver.isVersion(dep.currentValue)) {
    dep.skipReason = 'unsupported-version';
  }
  return { deps: [dep] };
}
