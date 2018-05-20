// const datasource = require('../../datasource/npm');
const versioning = require('../../versioning/semver.js');
const moment = require('moment');

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
  rangify,
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
  const allVersions = Object.keys(versions);
  const allSatisfyingVersions = allVersions.filter(version =>
    matchesSemver(version, currentVersion)
  );
  let fromVersion;
  if (!allSatisfyingVersions.length) {
    const lessThanVersions = allVersions.filter(version =>
      isLessThan(version, currentVersion)
    );
    // istanbul ignore if
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
    const toVersion = lessThanVersions.pop();
    const newVersion = rangify(config, currentVersion, fromVersion, toVersion);
    return [
      {
        type: 'rollback',
        branchName:
          '{{{branchPrefix}}}rollback-{{{depNameSanitized}}}-{{{newVersionMajor}}}.x',
        commitMessageAction: 'Roll back',
        isRollback: true,
        newVersion,
        newVersionMajor: getMajor(toVersion),
        semanticCommitType: 'fix',
        unpublishable: false,
      },
    ];
  }
  const updates = [];
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
    // console.log('currentVersion is pinned');
    fromVersion = currentVersion;
  }
  // Leave only versions greater than current
  let filteredVersions = allVersions.filter(version =>
    isGreaterThan(version, fromVersion)
  );
  // Filter out unstable
  if (ignoreUnstable) {
    if (isStable(fromVersion)) {
      // Remove all unstable
      filteredVersions = filteredVersions.filter(isStable);
    } else {
      // Allow unstable in current major
      filteredVersions = filteredVersions.filter(
        version =>
          isStable(version) || getMajor(version) === getMajor(fromVersion)
      );
    }
  }
  // Filter out those past latest
  if (
    respectLatest &&
    latestVersion &&
    !isGreaterThan(fromVersion, latestVersion)
  ) {
    filteredVersions = filteredVersions.filter(
      version => !isGreaterThan(version, latestVersion)
    );
  }
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
    const version = versions[toVersion];
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
