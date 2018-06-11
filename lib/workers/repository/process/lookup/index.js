const versioning = require('../../../../versioning');
const { getRollbackUpdate } = require('./rollback');
const { getRangeStrategy } = require('../../../../manager');
const { filterVersions } = require('./filter');
const { getDependency } = require('../../../../datasource');

module.exports = {
  lookupUpdates,
};

async function lookupUpdates(config) {
  const { depName, currentValue } = config;
  logger.debug({ depName, currentValue }, 'lookupUpdates');
  const {
    getMajor,
    getMinor,
    isGreaterThan,
    isSingleVersion,
    isVersion,
    matches,
    getNewValue,
  } = versioning(config.versionScheme);
  const dependency = await getDependency(config.purl, config);
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
    // TODO: return an object
    return [result];
  }
  // Filter out any results from datasource that don't comply with our versioning scheme
  const allVersions = Object.keys(dependency.versions).filter(v =>
    isVersion(v)
  );
  // istanbul ignore if
  if (allVersions.length === 0) {
    const message = `No versions returned from registry for this package`;
    logger.warn({ dependency }, message);
    // TODO: return an object
    return [
      {
        type: 'warning',
        message,
      },
    ];
  }
  // Check that existing constraint can be satisfied
  const allSatisfyingVersions = allVersions.filter(version =>
    matches(version, currentValue)
  );
  const updates = [];
  if (!allSatisfyingVersions.length) {
    const rollback = getRollbackUpdate(config, allVersions);
    // istanbul ignore if
    if (!rollback) {
      return [
        {
          type: 'warning',
          message: `Can't find version matching ${currentValue} for ${depName}`,
        },
      ];
    }
    updates.push(rollback);
  }
  const rangeStrategy = getRangeStrategy(config);
  const fromVersion = getFromVersion(config, rangeStrategy, allVersions);
  if (rangeStrategy === 'pin' && !isSingleVersion(currentValue)) {
    updates.push({
      type: 'pin',
      isPin: true,
      newValue: getNewValue(
        currentValue,
        rangeStrategy,
        fromVersion,
        fromVersion
      ),
      newMajor: getMajor(fromVersion),
    });
  }
  // Filter latest, unstable, etc
  const filteredVersions = filterVersions(
    config,
    fromVersion,
    dependency.latestVersion,
    allVersions
  );
  if (!filteredVersions.length) {
    return updates;
  }
  const buckets = {};
  for (const toVersion of filteredVersions) {
    const update = { fromVersion, toVersion };
    update.newValue = getNewValue(
      currentValue,
      rangeStrategy,
      fromVersion,
      toVersion
    );
    if (!update.newValue || update.newValue === currentValue) {
      continue; // eslint-disable-line no-continue
    }
    update.newMajor = getMajor(toVersion);
    update.newMinor = getMinor(toVersion);
    update.type = getType(config, fromVersion, toVersion);
    if (!isVersion(update.newValue)) {
      update.isRange = true;
    }

    update.canBeUnpublished = dependency.versions[toVersion].canBeUnpublished;

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
  // istanbul ignore if
  if (!(repositoryUrl && repositoryUrl.length)) {
    repositoryUrl = null;
  }
  return updates
    .concat(Object.values(buckets))
    .map(update => ({ ...update, repositoryUrl }));
}

function getType(config, fromVersion, toVersion) {
  const { versionScheme } = config;
  const { getMajor, getMinor } = versioning(versionScheme);
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
  const { type, newMajor } = update;
  if (
    !separateMajorMinor ||
    config.groupName ||
    config.major.automerge === true ||
    (config.automerge && config.major.automerge !== false)
  ) {
    return 'latest';
  }
  if (separateMultipleMajor && type === 'major') {
    return `major-${newMajor}`;
  }
  return type;
}

function getFromVersion(config, rangeStrategy, allVersions) {
  const { currentValue, lockedVersion, versionScheme } = config;
  const { isVersion, maxSatisfyingVersion, minSatisfyingVersion } = versioning(
    versionScheme
  );
  if (isVersion(currentValue)) {
    return currentValue;
  }
  logger.trace(`currentValue ${currentValue} is range`);
  if (rangeStrategy === 'pin') {
    return lockedVersion || maxSatisfyingVersion(allVersions, currentValue);
  }
  if (rangeStrategy === 'bump') {
    // Use the lowest version in the current range
    return minSatisfyingVersion(allVersions, currentValue);
  }
  // Use the highest version in the current range
  return maxSatisfyingVersion(allVersions, currentValue);
}
