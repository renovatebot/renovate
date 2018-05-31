const versioning = require('../../../versioning/semver');
const moment = require('moment');
const { getRollbackUpdate } = require('./rollback');
const { getRangeStrategy } = require('./range');
const { filterVersions } = require('./filter');
const npmApi = require('../../../datasource/npm');

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

async function lookupUpdates(config) {
  const { depName, currentVersion, lockedVersion } = config;
  const dependency = await npmApi.getDependency(depName);
  if (!dependency) {
    // If dependency lookup fails then warn and return
    const result = {
      type: 'warning',
      message: `Failed to look up dependency ${depName}`,
    };
    logger.info(
      { dependency: depName, packageFile: config.packageFile },
      result.message
    );
    return [result];
  }
  const { latestVersion } = dependency;
  const allVersions = Object.keys(dependency.versions);
  // istanbul ignore if
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
  const updates = [];
  if (!allSatisfyingVersions.length) {
    updates.push(getRollbackUpdate(config, allVersions));
  }
  const rangeStrategy = getRangeStrategy(config);
  const fromVersion = getFromVersion(
    currentVersion,
    rangeStrategy,
    lockedVersion,
    allVersions
  );
  if (isRange(currentVersion) && rangeStrategy === 'pin') {
    updates.push({
      type: 'pin',
      isPin: true,
      newVersion: fromVersion,
      newVersionMajor: getMajor(fromVersion),
      unpublishable: false,
    });
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
    update.newVersion = rangify(config, currentVersion, fromVersion, toVersion);
    if (!update.newVersion || update.newVersion === currentVersion) {
      continue; // eslint-disable-line no-continue
    }
    update.newVersionMajor = getMajor(toVersion);
    update.newVersionMinor = getMinor(toVersion);
    update.type = getType(config, fromVersion, toVersion);
    if (isRange(update.newVersion)) {
      update.isRange = true;
    }

    // TODO: move unpublishable to npm-specific
    const version = dependency.versions[toVersion];
    const elapsed =
      version && version.time
        ? moment().diff(moment(version.time), 'days')
        : 999;
    update.unpublishable = elapsed === 0;
    // end TODO

    const bucket = getBucket(config, update);
    if (buckets[bucket]) {
      if (isGreaterThan(update.toVersion, buckets[bucket].toVersion)) {
        buckets[bucket] = update;
      }
    } else {
      buckets[bucket] = update;
    }
  }
  let { repositoryUrl } = dependency;
  if (!(repositoryUrl && repositoryUrl.length)) {
    repositoryUrl = null;
  }
  if (!repositoryUrl && depName.startsWith('@types/')) {
    logger.debug('Setting @types url manually');
    repositoryUrl = `https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/${depName.replace(
      '@',
      ''
    )}`;
  }
  return updates
    .concat(Object.values(buckets))
    .map(update => ({ ...update, repositoryUrl }));
}

function getType(config, fromVersion, toVersion) {
  if (getMajor(toVersion) > getMajor(fromVersion)) {
    return 'major';
  }
  if (getMinor(toVersion) > getMinor(fromVersion)) {
    return 'minor';
  }
  if (config.separateMinorPatch) {
    return 'patch';
  }
  if (config.patch.automerge && !config.minor.automerge) {
    return 'patch';
  }
  return 'minor';
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

function getFromVersion(
  currentVersion,
  rangeStrategy,
  lockedVersion,
  allVersions
) {
  if (!isRange(currentVersion)) {
    return currentVersion;
  }
  logger.trace(`currentVersion ${currentVersion} is range`);
  if (rangeStrategy === 'pin') {
    return lockedVersion || maxSatisfyingVersion(allVersions, currentVersion);
  }
  if (rangeStrategy === 'bump') {
    // Use the lowest version in the current range
    return minSatisfyingVersion(allVersions, currentVersion);
  }
  // Use the highest version in the current range
  return maxSatisfyingVersion(allVersions, currentVersion);
}
