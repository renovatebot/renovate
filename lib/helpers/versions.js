const logger = require('winston');
const semver = require('semver');
const stable = require('semver-stable');

module.exports = {
  determineUpgrades,
  isRange,
  isValidVersion,
  isFuture,
  isPastLatest,
};

function determineUpgrades(dep, currentVersion, config) {
  const versions = dep.versions;
  if (!isValidVersion(currentVersion)) {
    logger.verbose(`${dep.name} currentVersion is invalid`);
    return [];
  }
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
  // Loop through all possible versions
  versionList.forEach((newVersion) => {
    if (semver.gt(newVersion, workingVersion)) {
      if (config.ignoreUnstable && stable.is(workingVersion) && !stable.is(newVersion)) {
        // Ignore unstable versions, unless the current version is unstable
        logger.debug(`Ignoring version ${newVersion} because it's unstable`);
        return;
      }
      if (config.ignoreFuture &&
          !isFuture(versions[workingVersion]) && isFuture(versions[newVersion])) {
        logger.debug(`Ignoring version ${newVersion} because it's marked as "future"`);
        return;
      }
      if (config.respectLatest
          && isPastLatest(dep, newVersion) && !isPastLatest(dep, workingVersion)) {
        logger.debug(`Ignoring version ${newVersion} because it's newer than the repo's "latest" tag`);
        return;
      }
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
