const logger = require('winston');
const semver = require('semver');
const stable = require('semver-stable');
const _ = require('lodash');
const semverUtils = require('semver-utils');

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
  let changeLogFromVersion = currentVersion;
  // Check for a current range and pin it
  if (isRange(currentVersion)) {
    // Pin ranges to their maximum satisfying version
    const maxSatisfying = semver.maxSatisfying(versionList, currentVersion);
    if (config.pinVersions) {
      allUpgrades.pin = {
        upgradeType: 'pin',
        newVersion: maxSatisfying,
        newVersionMajor: semver.major(maxSatisfying),
      };
    }
    changeLogFromVersion = maxSatisfying;
  }
  _(versionList)
    // Filter out older versions as we can't upgrade to those
    .filter(version => semver.gt(version, changeLogFromVersion))

    // Ignore unstable versions, unless the current version is unstable
    .reject(version => config.ignoreUnstable &&
            stable.is(changeLogFromVersion) && !stable.is(version))

    // Ignore future versions, unless the current version is marked as future
    .reject(version => config.ignoreFuture &&
            !isFuture(versions[changeLogFromVersion]) && isFuture(versions[version]))

    // Ignore versions newer than "latest", unless current version is newer than the "latest"
    .reject(version => config.respectLatest &&
            isPastLatest(dep, version) && !isPastLatest(dep, changeLogFromVersion))

    // Loop through all possible versions
    .forEach((newVersion) => {
      // Group by major versions
      const newVersionMajor = semver.major(newVersion);
      // Save this, if it's a new major version or greater than the previous greatest
      if (!allUpgrades[newVersionMajor] ||
          semver.gt(newVersion, allUpgrades[newVersionMajor].newVersion)) {
        const upgradeType = newVersionMajor > semver.major(changeLogFromVersion) ? 'major' : 'minor';
        const changeLogToVersion = newVersion;
        allUpgrades[newVersionMajor] = {
          upgradeType,
          newVersion,
          newVersionMajor,
          changeLogFromVersion,
          changeLogToVersion,
        };
      }
    });
  if (allUpgrades.pin && Object.keys(allUpgrades).length > 1) {
    // Remove the pin if we found upgrades
    delete allUpgrades.pin;
  }
  // Return only the values - we don't need the keys anymore
  const pinnedUpgrades = Object.keys(allUpgrades).map(key => allUpgrades[key]);

  if (isRange(currentVersion) && !config.pinVersions) {
    // The user prefers to maintain ranges, so we need to unpin our upgrades
    const semverParsed = semverUtils.parseRange(currentVersion);
    if (semverParsed.length > 1) {
      // We don't know how to support complex semver ranges, so don't upgrade
      logger.warn(`Can't support upgrading complex range ${currentVersion}`);
      return [];
    }
    // Start with empty set of range upgrades
    const rangeUpgrades = [];
    // We know we have a simple semver, now check which operator it is
    const semverOperator = semverParsed[0].operator;
    if (semverOperator === '~') {
      pinnedUpgrades.forEach((upgrade) => {
        const upgradeMajor = semver.major(upgrade.newVersion);
        const upgradeMinor = semver.minor(upgrade.newVersion);
        // Utilise that a.b is the same as ~a.b.0
        const newRange = `${upgradeMajor}.${upgradeMinor}`;
        // Now find the minimum upgrade that satisfies the range
        const minSatisfying = semver.minSatisfying(versionList, newRange);
        const newUpgrade = Object.assign({}, upgrade);
        // Add a tilde before that version number
        newUpgrade.newVersion = `~${minSatisfying}`;
        rangeUpgrades.push(newUpgrade);
      });
    } else if (semverOperator === '^') {
      pinnedUpgrades.forEach((upgrade) => {
        const upgradeMajor = semver.major(upgrade.newVersion);
        const upgradeMinor = semver.minor(upgrade.newVersion);
        let newRange = `${upgradeMajor}`;
        // If version is < 1, then semver treats ^ same as ~
        if (upgradeMajor === 0) {
          newRange = `${upgradeMajor}.${upgradeMinor}`;
        }
        const minSatisfying = semver.minSatisfying(versionList, newRange);
        const newUpgrade = Object.assign({}, upgrade);
        // Add in the caret
        newUpgrade.newVersion = `^${minSatisfying}`;
        rangeUpgrades.push(newUpgrade);
      });
    } else if (semverOperator === '<=') {
      pinnedUpgrades.forEach((upgrade) => {
        const newUpgrade = Object.assign({}, upgrade);
        // Add the operator to the front of the pinned upgrade version
        newUpgrade.newVersion = `<= ${upgrade.newVersion}`;
        rangeUpgrades.push(newUpgrade);
      });
    } else {
      // We don't support these operators yet
      logger.warn(`Unsupported semver operator '${semverOperator}'`);
    }
    return rangeUpgrades;
  }
  return pinnedUpgrades;
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
