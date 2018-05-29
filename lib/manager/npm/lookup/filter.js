const {
  getMajor,
  isGreaterThan,
  isStable,
} = require('../../../versioning/semver');

module.exports = {
  filterVersions,
  filterUnstable,
  filterLatest,
};

function filterVersions(config, fromVersion, latestVersion, versions) {
  const { ignoreUnstable, respectLatest } = config;
  if (!fromVersion) {
    return [];
  }
  // Leave only versions greater than current
  let filteredVersions = versions.filter(version =>
    isGreaterThan(version, fromVersion)
  );
  filteredVersions = filterUnstable(
    ignoreUnstable,
    fromVersion,
    filteredVersions
  );
  filteredVersions = filterLatest(
    respectLatest,
    fromVersion,
    latestVersion,
    filteredVersions
  );
  return filteredVersions;
}

function filterUnstable(ignoreUnstable, fromVersion, versions) {
  // Filter nothing out if we are not ignoring unstable
  if (ignoreUnstable === false) {
    return versions;
  }
  // Filter out all unstable if fromVersion is stable
  if (isStable(fromVersion)) {
    // Remove all unstable
    return versions.filter(isStable);
  }
  // Allow unstable only in current major
  return versions.filter(
    version => isStable(version) || getMajor(version) === getMajor(fromVersion)
  );
}

function filterLatest(respectLatest, fromVersion, latestVersion, versions) {
  // No filtering if no latest
  if (!latestVersion) {
    return versions;
  }
  // No filtering if not respecting latest
  if (respectLatest === false) {
    return versions;
  }
  // No filtering if fromVersion is already past latest
  if (isGreaterThan(fromVersion, latestVersion)) {
    return versions;
  }
  return versions.filter(version => !isGreaterThan(version, latestVersion));
}
