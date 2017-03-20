const logger = require('winston');
const semver = require('semver');
const stable = require('semver-stable');
const _ = require('lodash');
const semverUtils = require('semver-utils');

module.exports = {
  determineRangeUpgrades,
  determineUpgrades,
  isRange,
  isValidVersion,
  isFuture,
  isPastLatest,
  computeRangedVersion,
};

function determineRangeUpgrades(dep, currentVersion, config) {
  if (!isValidVersion(currentVersion)) {
    logger.verbose(`${dep.name} currentVersion is invalid`);
    return [];
  }
  const versions = dep.versions;
  if (!versions || Object.keys(versions).length === 0) {
    logger.verbose(`${dep.name} - no versions`);
    return [];
  }
  const versionList = Object.keys(versions);
  const workingVersion = semver.maxSatisfying(versionList, currentVersion);

  return _.chain(versionList)

    // Filter out older versions as we can't upgrade to those
    .filter(version => semver.gt(version, workingVersion))

    // Ignore unstable versions, unless the current version is unstable
    .reject(version => config.ignoreUnstable &&
            stable.is(workingVersion) && !stable.is(version))

    // Ignore future versions, unless the current version is marked as future
    .reject(version => config.ignoreFuture &&
            !isFuture(versions[workingVersion]) && isFuture(versions[version]))

    // Ignore versions newer than "latest", unless current version is newer than the "latest"
    .reject(version => config.respectLatest &&
            isPastLatest(dep, version) && !isPastLatest(dep, workingVersion))

    // Process all remaining versions
    .reduce((upgrades, newVersion) => {
      const parsedVersion = semver.parse(newVersion);
      const newUpgrade = {};

      // Group updates for the current dependency by the major version.
      if (!upgrades[parsedVersion.major] ||
          semver.gt(newVersion, upgrades[parsedVersion.major].newVersion)) {
        let upgradeType = 'patch';

        if (parsedVersion.major > semver.major(workingVersion)) {
          upgradeType = 'major';
        } else if (parsedVersion.minor > semver.minor(workingVersion)) {
          upgradeType = 'minor';
        }

        newUpgrade[parsedVersion.major] = {
          upgradeType,
          newVersion,
          newVersionMajor: parsedVersion.major,
          newVersionMinor: parsedVersion.minor,
          newVersionRange: computeRangedVersion(currentVersion, newVersion),
          workingVersion,
        };
      }

      return Object.assign({}, upgrades, newUpgrade);
    }, {})

    .map(upgrade => upgrade)

    // Execute chained Lodash sequence to unwrapped the final value, result, of the chain.
    .value()
  ;
}

function determineUpgrades(dep, currentVersion, config) {
  if (!isValidVersion(currentVersion)) {
    logger.verbose(`${dep.name} currentVersion is invalid`);
    return [];
  }
  const versions = dep.versions;
  if (!versions || Object.keys(versions).length === 0) {
    logger.verbose(`${dep.name} - no versions`);
    return [];
  }
  const versionList = Object.keys(versions);
  const workingVersion = semver.maxSatisfying(versionList, currentVersion);
  const upgrades = {};

  // Check for a current range and pin it
  if (isRange(currentVersion)) {
    upgrades.pin = {
      upgradeType: 'pin',
      newVersion: workingVersion,
      newVersionMajor: semver.major(workingVersion),
      newVersionRange: workingVersion,
    };
  }
  _.chain(versionList)
    // Filter out older versions as we can't upgrade to those
    .filter(version => semver.gt(version, workingVersion))

    // Ignore unstable versions, unless the current version is unstable
    .reject(version => config.ignoreUnstable &&
            stable.is(workingVersion) && !stable.is(version))

    // Ignore future versions, unless the current version is marked as future
    .reject(version => config.ignoreFuture &&
            !isFuture(versions[workingVersion]) && isFuture(versions[version]))

    // Ignore versions newer than "latest", unless current version is newer than the "latest"
    .reject(version => config.respectLatest &&
            isPastLatest(dep, version) && !isPastLatest(dep, workingVersion))

    // Loop through all possible versions
    .forEach((newVersion) => {
      const parsedVersion = semver.parse(newVersion);

      // Group updates for the current dependency by the major version.
      if (!upgrades[parsedVersion.major] ||
          semver.gt(newVersion, upgrades[parsedVersion.major].newVersion)) {
        let upgradeType = 'patch';

        if (parsedVersion.major > semver.major(workingVersion)) {
          upgradeType = 'major';
        } else if (parsedVersion.minor > semver.minor(workingVersion)) {
          upgradeType = 'minor';
        }

        upgrades[parsedVersion.major] = {
          upgradeType,
          newVersion,
          newVersionMajor: parsedVersion.major,
          newVersionMinor: parsedVersion.minor,
          newVersionRange: newVersion,
          workingVersion,
        };
      }
    })

    // Execute chained Lodash sequence to unwrapped the final value, result, of the chain.
    .value()
  ;

  if (upgrades.pin && Object.keys(upgrades).length > 1) {
    // Remove the pin if we found upgrades
    delete upgrades.pin;
  }
  // Return only the values - we don't need the keys anymore
  return Object.keys(upgrades).map(key => upgrades[key]);
}

function isRange(input) {
  // Pinned versions also return true for semver.validRange
  // We need to check first that they're not 'valid' to get only ranges
  return (semver.valid(input) === null && semver.validRange(input) !== null);
}

function isValidVersion(input) {
  return (semver.valid(input) || semver.validRange(input)) !== null;
}

function isFuture(version) {
  return version && version.publishConfig && version.publishConfig.tag === 'future';
}

function isPastLatest(dep, version) {
  if (dep['dist-tags'] && dep['dist-tags'].latest) {
    return semver.gt(version, dep['dist-tags'].latest);
  }
  logger.warn(`No dist-tags.latest for ${dep.name}`);
  return false;
}

function computeRangedVersion(currentVersion, newVersion) {
  const parsedRange = semverUtils.parseRange(currentVersion);

  // Check whether the current version is pinned, and if so, just return the
  // new version, which, itself, should be a pinned version number.
  if (parsedRange.length === 1 && parsedRange[0].operator === undefined) {
    return newVersion;
  }

  // Check whether the existing version range is _simple_, meaning
  // the range is a single operator, such as `^` or `~`, on a single operand, `1.0.0`.
  // If so, use that range for the new version, and return that ranged version.
  if (parsedRange.length === 1 && _.includes(['^', '~'], parsedRange[0].operator)) {
    return parsedRange[0].operator + newVersion;
  }

  // Otherwise, just append the new version to the existing version range.
  return `${currentVersion} || ${newVersion}`;
}
