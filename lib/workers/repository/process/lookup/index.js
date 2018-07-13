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
    equals,
    getMajor,
    getMinor,
    isGreaterThan,
    isSingleVersion,
    isVersion,
    matches,
    getNewValue,
  } = versioning(config.versionScheme);
  const res = { updates: [] };
  const dependency = await getDependency(config.purl, config);
  if (!dependency) {
    // If dependency lookup fails then warn and return
    const result = {
      updateType: 'warning',
      message: `Failed to look up dependency ${depName}`,
    };
    logger.info(
      { dependency: depName, packageFile: config.packageFile },
      result.message
    );
    // TODO: return warnings in own field
    res.updates.push(result);
    return res;
  }
  // istanbul ignore if
  if (dependency.deprecationMessage) {
    logger.info('Setting deprecationMessage');
    res.deprecationMessage = dependency.deprecationMessage;
  }
  res.repositoryUrl =
    dependency.repositoryUrl && dependency.repositoryUrl.length
      ? dependency.repositoryUrl
      : null;
  const { releases } = dependency;
  // Filter out any results from datasource that don't comply with our versioning scheme
  const allVersions = releases
    .map(release => release.version)
    .filter(v => isVersion(v));
  // istanbul ignore if
  if (allVersions.length === 0) {
    const message = `No versions returned from registry for this package`;
    logger.warn({ dependency: depName, result: dependency }, message);
    // TODO: return an object
    res.updates.push([
      {
        updateType: 'warning',
        message,
      },
    ]);
    return res;
  }
  // Check that existing constraint can be satisfied
  const allSatisfyingVersions = allVersions.filter(version =>
    matches(version, currentValue)
  );
  if (!allSatisfyingVersions.length) {
    const rollback = getRollbackUpdate(config, allVersions);
    // istanbul ignore if
    if (!rollback) {
      res.updates.push([
        {
          updateType: 'warning',
          message: `Can't find version matching ${currentValue} for ${depName}`,
        },
      ]);
      return res;
    }
    res.updates.push(rollback);
  }
  const rangeStrategy = getRangeStrategy(config);
  const fromVersion = getFromVersion(config, rangeStrategy, allVersions);
  if (rangeStrategy === 'pin' && !isSingleVersion(currentValue)) {
    res.updates.push({
      updateType: 'pin',
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
    allVersions,
    releases
  );
  if (!filteredVersions.length) {
    return res;
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
    update.updateType = getType(config, fromVersion, toVersion);
    update.isSingleVersion = !!isSingleVersion(update.newValue);
    if (!isVersion(update.newValue)) {
      update.isRange = true;
    }
    const updateRelease = releases.find(release =>
      equals(release.version, toVersion)
    );
    update.releaseTimestamp = updateRelease.releaseTimestamp;
    update.canBeUnpublished = updateRelease.canBeUnpublished;

    const bucket = getBucket(config, update);
    if (buckets[bucket]) {
      if (isGreaterThan(update.toVersion, buckets[bucket].toVersion)) {
        buckets[bucket] = update;
      }
    } else {
      buckets[bucket] = update;
    }
  }
  res.updates = res.updates.concat(Object.values(buckets));
  res.releases = releases.filter(
    release =>
      filteredVersions.includes(release.version) ||
      release.version === fromVersion
  );
  if (res.updates.some(update => update.updateType === 'pin')) {
    for (const update of res.updates) {
      if (update.updateType !== 'pin' && update.updateType !== 'rollback') {
        update.blockedByPin = true;
      }
    }
  }
  return res;
}

function getType(config, fromVersion, toVersion) {
  const { versionScheme, rangeStrategy, currentValue } = config;
  const { getMajor, getMinor, matches } = versioning(versionScheme);
  if (rangeStrategy === 'bump' && matches(toVersion, currentValue)) {
    return 'bump';
  }
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
  const { updateType, newMajor } = update;
  if (
    !separateMajorMinor ||
    config.groupName ||
    config.major.automerge === true ||
    (config.automerge && config.major.automerge !== false)
  ) {
    return 'latest';
  }
  if (separateMultipleMajor && updateType === 'major') {
    return `major-${newMajor}`;
  }
  return updateType;
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
