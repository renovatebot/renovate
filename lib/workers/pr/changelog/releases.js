const { getPkgReleases } = require('../../../datasource');
const versioning = require('../../../versioning');

module.exports = {
  getReleases,
};

async function getReleases(config) {
  const pkgReleases = (await getPkgReleases(config)).releases;
  const version = versioning.get(config.versionScheme);

  function matchesMMP(v1, v2) {
    return (
      version.getMajor(v1) === version.getMajor(v2) &&
      version.getMinor(v1) === version.getMinor(v2) &&
      version.getPatch(v1) === version.getPatch(v2)
    );
  }

  function matchesUnstable(v1, v2) {
    return !version.isStable(v1) && matchesMMP(v1, v2);
  }

  const releases = pkgReleases
    .filter(release =>
      version.isCompatible(release.version, config.fromVersion)
    )
    .filter(
      release =>
        version.equals(release.version, config.fromVersion) ||
        version.isGreaterThan(release.version, config.fromVersion)
    )
    .filter(
      release => !version.isGreaterThan(release.version, config.toVersion)
    )
    .filter(
      release =>
        version.isStable(release.version) ||
        matchesUnstable(config.fromVersion, release.version) ||
        matchesUnstable(config.toVersion, release.version)
    );
  if (version.valueToVersion) {
    for (const release of releases || []) {
      release.version = version.valueToVersion(release.version);
    }
  }
  return releases;
}
