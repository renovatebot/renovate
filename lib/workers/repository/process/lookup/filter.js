const semver = require('semver');
const { logger } = require('../../../../logger');
const versioning = require('../../../../versioning');

module.exports = {
  filterVersions,
};

function filterVersions(
  config,
  fromVersion,
  latestVersion,
  versions,
  releases
) {
  const {
    versionScheme,
    ignoreUnstable,
    ignoreDeprecated,
    respectLatest,
    allowedVersions,
  } = config;
  const version = versioning.get(versionScheme);
  if (!fromVersion) {
    return [];
  }

  // Leave only versions greater than current
  let filteredVersions = versions.filter(v =>
    version.isGreaterThan(v, fromVersion)
  );

  // Don't upgrade from non-deprecated to deprecated
  const fromRelease = releases.find(release => release.version === fromVersion);
  if (ignoreDeprecated && fromRelease && !fromRelease.isDeprecated) {
    filteredVersions = filteredVersions.filter(v => {
      const versionRelease = releases.find(release => release.version === v);
      if (versionRelease.isDeprecated) {
        logger.debug(
          `Skipping ${config.depName}@${v} because it is deprecated`
        );
        return false;
      }
      return true;
    });
  }

  if (allowedVersions) {
    if (version.isValid(allowedVersions)) {
      filteredVersions = filteredVersions.filter(v =>
        version.matches(v, allowedVersions)
      );
    } else if (versionScheme !== 'npm' && semver.validRange(allowedVersions)) {
      logger.debug(
        { depName: config.depName },
        'Falling back to npm semver syntax for allowedVersions'
      );
      filteredVersions = filteredVersions.filter(v =>
        semver.satisfies(
          // @ts-ignore
          semver.coerce(v),
          allowedVersions
        )
      );
    } else {
      logger.warn(
        { depName: config.depName },
        `Invalid allowedVersions: "${allowedVersions}"`
      );
    }
  }

  // Return all versions if we aren't ignore unstable. Also ignore latest
  if (config.followTag || ignoreUnstable === false) {
    return filteredVersions;
  }

  // if current is unstable then allow unstable in the current major only
  if (!version.isStable(fromVersion)) {
    // Allow unstable only in current major
    return filteredVersions.filter(
      v =>
        version.isStable(v) ||
        (version.getMajor(v) === version.getMajor(fromVersion) &&
          version.getMinor(v) === version.getMinor(fromVersion) &&
          version.getPatch(v) === version.getPatch(fromVersion))
    );
  }

  // Normal case: remove all unstable
  filteredVersions = filteredVersions.filter(v => version.isStable(v));

  // Filter the latest

  // No filtering if no latest
  // istanbul ignore if
  if (!latestVersion) {
    return filteredVersions;
  }
  // No filtering if not respecting latest
  if (respectLatest === false) {
    return filteredVersions;
  }
  // No filtering if fromVersion is already past latest
  if (version.isGreaterThan(fromVersion, latestVersion)) {
    return filteredVersions;
  }
  return filteredVersions.filter(v => !version.isGreaterThan(v, latestVersion));
}
