const logger = require('winston');
const semver = require('semver');
const stable = require('semver-stable');
const _ = require('lodash');

module.exports = {
  determineUpgrades,
  isRange,
  isValidVersion,
  isFuture,
  isPastLatest,
};

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
  const allUpgrades = {};
  let workingVersion = currentVersion;
  // Check for a current range and pin it
  if (isRange(currentVersion)) {
    // Pin ranges to their maximum satisfying version
    const maxSatisfying = semver.maxSatisfying(versionList, currentVersion);
    allUpgrades.pin = {
      upgradeType: 'pin',
      newVersion: maxSatisfying,
      newVersionMajor: semver.major(maxSatisfying),
    };
    workingVersion = maxSatisfying;
  }
  _(versionList)
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
      // Group by major versions
      const newVersionMajor = semver.major(newVersion);
      // Save this, if it's a new major version or greater than the previous greatest
      if (!allUpgrades[newVersionMajor] ||
          semver.gt(newVersion, allUpgrades[newVersionMajor].newVersion)) {
        const upgradeType = newVersionMajor > semver.major(workingVersion) ? 'major' : 'minor';
        allUpgrades[newVersionMajor] = {
          upgradeType,
          newVersion,
          newVersionMajor,
          workingVersion,
        };
      }
    });
  if (allUpgrades.pin && Object.keys(allUpgrades).length > 1) {
    // Remove the pin if we found upgrades
    delete allUpgrades.pin;
  }
  // Return only the values - we don't need the keys anymore
  return Object.keys(allUpgrades).map(key => allUpgrades[key]);
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
