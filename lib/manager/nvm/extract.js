const semver = require('../../versioning/semver');

module.exports = {
  extractDependencies,
};

function extractDependencies(content) {
  const dep = {
    depName: 'node',
    currentVersion: content.trim(),
    purl: 'pkg:github/nodejs/node?clean=true',
  };
  if (!semver.isPinnedVersion(dep.currentVersion)) {
    dep.skipReason = 'unsupported-version';
  }
  return { deps: [dep] };
}
