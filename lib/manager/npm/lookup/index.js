const versioning = require('../../../versioning/semver');
const moment = require('moment');
const { getRollbackUpdate } = require('./rollback');

const { filterVersions } = require('./filter');

const {
  getMajor,
  getMinor,
  isGreaterThan,
  isRange,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  rangify,
} = versioning;

module.exports = {
  lookupUpdates,
};

function lookupUpdates(dependency, config) {
  const { currentVersion, lockedVersion, rangeStrategy } = config;
  const { latestVersion } = dependency;
  const allVersions = Object.keys(dependency.versions);
  if (allVersions.length === 0) {
    const message = `No versions returned from registry for this package`;
    logger.warn({ dependency }, message);
    return [
      {
        type: 'warning',
        message,
      },
    ];
  }
  const allSatisfyingVersions = allVersions.filter(version =>
    matches(version, currentVersion)
  );
  if (!allSatisfyingVersions.length) {
    return getRollbackUpdate(config, allVersions);
  }
  const updates = [];
  let fromVersion;
  if (isRange(currentVersion)) {
    logger.trace(`currentVersion ${currentVersion} is range`);
    if (rangeStrategy === 'pin') {
      const pinVersion =
        lockedVersion || maxSatisfyingVersion(allVersions, currentVersion);
      updates.push({
        type: 'pin',
        isPin: true,
        newVersion: pinVersion,
        newVersionMajor: getMajor(pinVersion),
        unpublishable: false,
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
    fromVersion = currentVersion;
  }
  const filteredVersions = filterVersions(
    config,
    fromVersion,
    latestVersion,
    allVersions
  );
  if (!filteredVersions.length) {
    return updates;
  }
  const buckets = {};
  for (const toVersion of filteredVersions) {
    const update = { fromVersion, toVersion };
    update.newVersionMajor = getMajor(toVersion);
    update.newVersionMinor = getMinor(toVersion);
    if (update.newVersionMajor > getMajor(fromVersion)) {
      update.type = 'major';
      update.isMajor = true;
    } else if (
      update.newVersionMinor > getMinor(fromVersion) ||
      config.minor.automerge ||
      !(config.separateMinorPatch || config.patch.automerge)
    ) {
      update.type = 'minor';
      update.isMinor = true;
    } else {
      update.type = 'patch';
      update.isPatch = true;
    }
    // TODO: move unpublishable to npm-specific
    const version = dependency.versions[toVersion];
    const elapsed = version ? moment().diff(moment(version.time), 'days') : 999;
    update.unpublishable = elapsed > 0;
    // end TODO
    update.newVersion = rangify(config, currentVersion, fromVersion, toVersion);
    if (update.newVersion && update.newVersion !== currentVersion) {
      if (isRange(update.newVersion)) {
        update.isRange = true;
      }
      const bucket = getBucket(config, update);
      if (buckets[bucket]) {
        if (isGreaterThan(update.toVersion, buckets[bucket].toVersion)) {
          buckets[bucket] = update;
        }
      } else {
        buckets[bucket] = update;
      }
    }
  }
  return updates.concat(Object.values(buckets));
}

function getBucket(config, update) {
  const { separateMajorMinor, separateMultipleMajor } = config;
  const { type, newVersionMajor } = update;
  if (
    !separateMajorMinor ||
    config.groupName ||
    config.major.automerge === true ||
    (config.automerge && config.major.automerge !== false)
  ) {
    return 'latest';
  }
  if (separateMultipleMajor && type === 'major') {
    return `major-${newVersionMajor}`;
  }
  return type;
}
