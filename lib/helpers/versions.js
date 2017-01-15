const logger = require('winston');
const semver = require('semver');
const stable = require('semver-stable');

module.exports = {
  determineUpgrades,
  isRange,
  isValidVersion,
};

function determineUpgrades(depName, currentVersion, versions) {
  if (!isValidVersion(currentVersion)) {
    logger.verbose(`${depName} currentVersion is invalid`);
    return [];
  }
  if (!versions) {
    logger.verbose(`${depName} versions is null`);
    return [];
  }
  const allUpgrades = {};
  let workingVersion = currentVersion;
  // Check for a current range and pin it
  if (isRange(currentVersion)) {
    // Pin ranges to their maximum satisfying version
    const maxSatisfying = semver.maxSatisfying(versions, currentVersion);
    allUpgrades.pin = {
      upgradeType: 'pin',
      newVersion: maxSatisfying,
      newVersionMajor: semver.major(maxSatisfying),
    };
    workingVersion = maxSatisfying;
  }
  // Loop through all possible versions
  versions.forEach((newVersion) => {
    if (stable.is(workingVersion) && !stable.is(newVersion)) {
      // Ignore unstable versions, unless the current version is unstable
      return;
    }
    if (semver.gt(newVersion, workingVersion)) {
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
