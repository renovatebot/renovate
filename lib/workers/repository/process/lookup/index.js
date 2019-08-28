const { logger } = require('../../../../logger');
const versioning = require('../../../../versioning');
const { getRollbackUpdate } = require('./rollback');
const { getRangeStrategy } = require('../../../../manager');
const { filterVersions } = require('./filter');
const {
  getPkgReleases,
  supportsDigests,
  getDigest,
} = require('../../../../datasource');

const clone = input => JSON.parse(JSON.stringify(input));

module.exports = {
  lookupUpdates,
};

async function lookupUpdates(config) {
  const { depName, currentValue, lockedVersion } = config;
  logger.trace({ dependency: depName, currentValue }, 'lookupUpdates');
  const version = versioning.get(config.versionScheme);
  /** @type any */
  const res = { updates: [], warnings: [] };
  if (version.isValid(currentValue)) {
    const dependency = clone(await getPkgReleases(config));
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
      res.warnings.push(result);
      return res;
    }
    if (dependency.deprecationMessage) {
      logger.info({ dependency: depName }, 'Found deprecationMessage');
      res.deprecationMessage = dependency.deprecationMessage;
    }
    res.sourceUrl =
      dependency.sourceUrl && dependency.sourceUrl.length
        ? dependency.sourceUrl
        : null;
    if (dependency.sourceDirectory) {
      res.sourceDirectory = dependency.sourceDirectory;
    }
    res.homepage = dependency.homepage;
    res.changelogUrl = dependency.changelogUrl;
    // TODO: improve this
    // istanbul ignore if
    if (dependency.dockerRegistry) {
      res.dockerRegistry = dependency.dockerRegistry;
      res.dockerRepository = dependency.dockerRepository;
    }
    const { releases } = dependency;
    // Filter out any results from datasource that don't comply with our versioning scheme
    let allVersions = releases
      .map(release => release.version)
      .filter(v => version.isVersion(v));
    // istanbul ignore if
    if (allVersions.length === 0) {
      const message = `Found no results from datasource that look like a version`;
      logger.debug({ dependency: depName, result: dependency }, message);
      if (!config.currentDigest) {
        return res;
      }
    }
    if (config.followTag) {
      const taggedVersion = dependency.tags[config.followTag];
      if (!taggedVersion) {
        res.warnings.push({
          updateType: 'warning',
          message: `Can't find version with tag ${config.followTag} for ${depName}`,
        });
        return res;
      }
      allVersions = allVersions.filter(
        v =>
          v === taggedVersion ||
          (v === currentValue &&
            version.isGreaterThan(taggedVersion, currentValue))
      );
    }
    // Check that existing constraint can be satisfied
    const allSatisfyingVersions = allVersions.filter(v =>
      version.matches(v, currentValue)
    );
    if (config.rollbackPrs && !allSatisfyingVersions.length) {
      const rollback = getRollbackUpdate(config, allVersions);
      // istanbul ignore if
      if (!rollback) {
        res.warnings.push([
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
    if (
      fromVersion &&
      rangeStrategy === 'pin' &&
      !version.isSingleVersion(currentValue)
    ) {
      res.updates.push({
        updateType: 'pin',
        isPin: true,
        newValue: version.getNewValue(
          currentValue,
          rangeStrategy,
          fromVersion,
          fromVersion
        ),
        newMajor: version.getMajor(fromVersion),
      });
    }
    let filterStart = fromVersion;
    if (lockedVersion && rangeStrategy === 'update-lockfile') {
      // Look for versions greater than the current locked version that still satisfy the package.json range
      filterStart = lockedVersion;
    }
    // Filter latest, unstable, etc
    const filteredVersions = filterVersions(
      config,
      filterStart,
      dependency.latestVersion,
      allVersions,
      releases
    ).filter(v =>
      // Leave only compatible versions
      version.isCompatible(v, currentValue)
    );
    const buckets = {};
    for (const toVersion of filteredVersions) {
      const update = { fromVersion, toVersion };
      try {
        update.newValue = version.getNewValue(
          currentValue,
          rangeStrategy,
          fromVersion,
          toVersion
        );
      } catch (err) /* istanbul ignore next */ {
        logger.warn(
          { err, currentValue, rangeStrategy, fromVersion, toVersion },
          'getNewValue error'
        );
        update.newValue = currentValue;
      }
      if (!update.newValue || update.newValue === currentValue) {
        if (!config.lockedVersion) {
          continue; // eslint-disable-line no-continue
        }
        // istanbul ignore if
        if (rangeStrategy === 'bump') {
          logger.trace(
            { depName, currentValue, lockedVersion, toVersion },
            'Skipping bump because newValue is the same'
          );
          continue; // eslint-disable-line no-continue
        }
        update.updateType = 'lockfileUpdate';
        update.fromVersion = lockedVersion;
        update.displayFrom = lockedVersion;
        update.displayTo = toVersion;
        update.isSingleVersion = true;
      }
      update.newMajor = version.getMajor(toVersion);
      update.newMinor = version.getMinor(toVersion);
      update.updateType =
        update.updateType || getType(config, update.fromVersion, toVersion);
      update.isSingleVersion =
        update.isSingleVersion || !!version.isSingleVersion(update.newValue);
      if (!version.isVersion(update.newValue)) {
        update.isRange = true;
      }
      const updateRelease = releases.find(release =>
        version.equals(release.version, toVersion)
      );
      // TODO: think more about whether to just Object.assign this
      const releaseFields = [
        'releaseTimestamp',
        'canBeUnpublished',
        'downloadUrl',
        'checksumUrl',
      ];
      releaseFields.forEach(field => {
        if (updateRelease[field] !== undefined) {
          update[field] = updateRelease[field];
        }
      });

      const bucket = getBucket(config, update);
      if (buckets[bucket]) {
        if (
          version.isGreaterThan(update.toVersion, buckets[bucket].toVersion)
        ) {
          buckets[bucket] = update;
        }
      } else {
        buckets[bucket] = update;
      }
    }
    res.updates = res.updates.concat(Object.values(buckets));
    res.releases = releases.filter(
      release =>
        filteredVersions.length &&
        (filteredVersions.includes(release.version) ||
          release.version === filterStart)
    );
  } else if (!currentValue) {
    res.skipReason = 'unsupported-value';
  } else {
    logger.debug(`Dependency ${depName} has unsupported value ${currentValue}`);
    if (!config.pinDigests && !config.currentDigest) {
      res.skipReason = 'unsupported-value';
    }
  }
  // Add digests if necessary
  if (supportsDigests(config)) {
    if (config.currentDigest) {
      if (!config.digestOneAndOnly || !res.updates.length) {
        // digest update
        res.updates.push({
          updateType: 'digest',
          newValue: config.currentValue,
        });
      }
    } else if (config.pinDigests) {
      // Create a pin only if one doesn't already exists
      if (!res.updates.some(update => update.updateType === 'pin')) {
        // pin digest
        res.updates.push({
          updateType: 'pin',
          newValue: config.currentValue,
        });
      }
    }
    if (version.valueToVersion) {
      for (const release of res.releases || []) {
        release.version = version.valueToVersion(release.version);
      }
      for (const update of res.updates || []) {
        update.newVersion = version.valueToVersion(update.newValue);
        update.fromVersion = version.valueToVersion(update.fromVersion);
        update.toVersion = version.valueToVersion(update.toVersion);
      }
    }
    // update digest for all
    for (const update of res.updates) {
      if (config.pinDigests || config.currentDigest) {
        update.newDigest = await getDigest(config, update.newValue);
        if (update.newDigest) {
          update.newDigestShort = update.newDigest
            .replace('sha256:', '')
            .substring(0, 7);
        } else {
          logger.info({ newValue: update.newValue }, 'Could not getDigest');
        }
      }
    }
  }
  for (const update of res.updates) {
    const { updateType, fromVersion, toVersion } = update;
    if (['bump', 'lockfileUpdate'].includes(updateType)) {
      update[updateType === 'bump' ? 'isBump' : 'isLockfileUpdate'] = true;
      if (version.getMajor(toVersion) > version.getMajor(fromVersion)) {
        update.updateType = 'major';
      } else if (
        config.separateMinorPatch &&
        version.getMinor(toVersion) === version.getMinor(fromVersion)
      ) {
        update.updateType = 'patch';
      } else {
        update.updateType = 'minor';
      }
    }
  }
  // Strip out any non-changed ones
  res.updates = res.updates
    .filter(update => update.newDigest !== null)
    .filter(
      update =>
        update.newValue !== config.currentValue ||
        update.isLockfileUpdate ||
        (update.newDigest && !update.newDigest.startsWith(config.currentDigest))
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
  const version = versioning.get(versionScheme);
  if (rangeStrategy === 'bump' && version.matches(toVersion, currentValue)) {
    return 'bump';
  }
  if (version.getMajor(toVersion) > version.getMajor(fromVersion)) {
    return 'major';
  }
  if (version.getMinor(toVersion) > version.getMinor(fromVersion)) {
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
  if (updateType === 'lockfileUpdate') {
    return updateType;
  }
  if (
    !separateMajorMinor ||
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
  const version = versioning.get(versionScheme);
  if (version.isVersion(currentValue)) {
    return currentValue;
  }
  if (version.isSingleVersion(currentValue)) {
    return currentValue.replace(/=/g, '').trim();
  }
  logger.trace(`currentValue ${currentValue} is range`);
  if (rangeStrategy === 'pin') {
    return (
      lockedVersion || version.maxSatisfyingVersion(allVersions, currentValue)
    );
  }
  if (rangeStrategy === 'bump') {
    // Use the lowest version in the current range
    return version.minSatisfyingVersion(allVersions, currentValue);
  }
  // Use the highest version in the current range
  return version.maxSatisfyingVersion(allVersions, currentValue);
}
