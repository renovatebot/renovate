const {
  getMajor,
  isGreaterThan,
  isStable,
  isValid,
  matches,
} = require('../../../../versioning/semver');

module.exports = {
  filterVersions,
  filterLatest,
};

function filterVersions(config, fromVersion, latestVersion, versions) {
  const { ignoreUnstable, respectLatest, allowedVersions } = config;
  if (!fromVersion) {
    return [];
  }

  // Leave only versions greater than current
  let filteredVersions = versions.filter(version =>
    isGreaterThan(version, fromVersion)
  );

  if (allowedVersions) {
    if (isValid(allowedVersions)) {
      filteredVersions = filteredVersions.filter(version =>
        matches(version, allowedVersions)
      );
    } else {
      logger.warn(`Invalid allowedVersions: "${allowedVersions}"`);
    }
  }

  // Return all versions if we aren't ignore unstable. Also ignore latest
  if (ignoreUnstable === false) {
    return filteredVersions;
  }

  // if current is unstable then allow unstable in the current major only
  if (!isStable(fromVersion)) {
    // Allow unstable only in current major
    return filteredVersions.filter(
      version =>
        isStable(version) || getMajor(version) === getMajor(fromVersion)
    );
  }

  // Normal case: remove all unstable
  filteredVersions = filteredVersions.filter(isStable);

  return filterLatest(
    respectLatest,
    fromVersion,
    latestVersion,
    filteredVersions
  );
}

function filterLatest(respectLatest, fromVersion, latestVersion, versions) {
  // No filtering if no latest
  // istanbul ignore if
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
