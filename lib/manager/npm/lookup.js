// const datasource = require('../../datasource/npm');
const versioning = require('../../util/semver.js');

const {
  getMajor,
  getMinor,
  isGreaterThan,
  isLessThan,
  isRange,
  isStable,
  matchesSemver,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  semverSort,
  parseRange,
} = versioning;

module.exports = {
  lookupUpdates,
};

function lookupUpdates(dependency, config) {
  const {
    packageFile,
    depName,
    currentVersion,
    lockedVersion,
    rangeStrategy,
    ignoreUnstable,
    respectLatest,
  } = config;
  const { versions, latestVersion } = dependency;
  if (!versions || Object.keys(versions).length === 0) {
    const message = `No versions returned from registry for this package`;
    logger.warn({ dependency }, message);
    return [
      {
        type: 'warning',
        message,
      },
    ];
  }
  const allVersions = versions ? Object.keys(versions) : [];
  const allSatisfyingVersions = allVersions.filter(version =>
    matchesSemver(version, currentVersion)
  );
  if (!allSatisfyingVersions.length) {
    const lessThanVersions = allVersions.filter(version =>
      isLessThan(version, currentVersion)
    );
    if (!lessThanVersions.length) {
      logger.warn(
        { packageFile, depName, currentVersion },
        'Missing version has nothing to roll back to'
      );
      return [];
    }
    logger.info(
      { packageFile, depName, currentVersion },
      `Current version not found - rolling back`
    );
    lessThanVersions.sort(semverSort);
    return [
      {
        type: 'rollback',
        toVersion: lessThanVersions.pop(),
      },
    ];
  }
  let fromVersion;
  const updates = [];
  if (isRange(currentVersion)) {
    logger.debug('currentVersion is range');
    if (rangeStrategy === 'pin') {
      logger.debug(`Pinning ${currentVersion}`);
      const pinVersion =
        lockedVersion || minSatisfyingVersion(allVersions, currentVersion);
      updates.push({
        type: 'pin',
        toVersion: pinVersion,
      });
      // Use this pinned version as the fromVersion for any other updates
      fromVersion = pinVersion;
    } else if (rangeStrategy === 'bump') {
      // Use the lowest version in the current range
      fromVersion = minSatisfyingVersion(allVersions, currentVersion);
    } else {
      // Use the highest version in the current range
      fromVersion = maxSatisfyingVersion(allVersions, currentVersion);
    }
  } else {
    logger.debug('currentVersion is pinned');
    fromVersion = currentVersion;
  }
  // Leave only versions greater than current
  let filteredVersions = allVersions.filter(version =>
    isGreaterThan(version, fromVersion)
  );
  // Filter out unstable
  if (isStable(fromVersion) && ignoreUnstable) {
    filteredVersions = filteredVersions.filter(isStable);
  }
  // Filter out those past latest
  if (
    latestVersion &&
    isLessThan(currentVersion, latestVersion) &&
    respectLatest
  ) {
    filteredVersions = filteredVersions.filter(
      version => !isGreaterThan(version, latestVersion)
    );
  }
  if (!filteredVersions.length) {
    return updates;
  }
  logger.debug({ packageFile, depName }, 'Newer versions exist');
  const buckets = {};
  for (const toVersion of filteredVersions) {
    const update = { toVersion };
    update.newVersionMajor = getMajor(toVersion);
    update.newVersionMinor = getMinor(toVersion);
    update.isMajorUpdate = update.newVersionMajor > getMajor(fromVersion);
    update.isMinorUpdate = update.isMajorUpdate
      ? false
      : update.newVersionMinor > getMinor(fromVersion);
    const bucket = getBucket(config, update);
    if (buckets[bucket]) {
      if (isGreaterThan(update.toVersion, buckets[bucket].toVersion)) {
        buckets[bucket] = update;
      }
    }
  }
  return Object.values(buckets);
}

function rangify(config, currentVersion, toVersion) {
  const { rangeStrategy } = config;
  if (rangeStrategy === 'pin') {
    return toVersion;
  }
  const parsedRange = parseRange(currentVersion);
}

function getBucket(config, update) {
  const {
    separateMajorMinor,
    separateMultipleMajor,
    separateMinorPatch,
  } = config;
  const { isMajorUpdate, isMinorUpdate, newVersionMajor } = update;
  if (
    !separateMajorMinor ||
    config.groupName ||
    (config.automerge && config.major.automerge !== false) ||
    config.major.automerge === true
  ) {
    return 'latest';
  }
  if (isMajorUpdate) {
    if (separateMultipleMajor) {
      return `major-${newVersionMajor}`;
    }
    return 'major';
  }
  if (separateMinorPatch) {
    if (isMinorUpdate) {
      return 'minor';
    }
    return 'patch';
  }
  return 'minor';
}
