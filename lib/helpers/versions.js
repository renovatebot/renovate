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
    allUpgrades.pin = {
      upgradeType: 'pin',
      newVersion: maxSatisfying,
      newVersionMajor: semver.major(maxSatisfying),
    };
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
      // Only split majors if configured to do so, and no group or 'any' automerge
      const separateMajors = config.separateMajorReleases && !config.groupName && config.automerge !== 'any';
      const upgradeKey = separateMajors ? newVersionMajor : 'latest';
      // Save this, if it's a new major version or greater than the previous greatest
      if (!allUpgrades[upgradeKey] ||
          semver.gt(newVersion, allUpgrades[upgradeKey].newVersion)) {
        const upgradeType = newVersionMajor > semver.major(changeLogFromVersion) ? 'major' : 'minor';
        const changeLogToVersion = newVersion;
        allUpgrades[upgradeKey] = {
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
  const upgrades = Object.keys(allUpgrades).map(key => allUpgrades[key]);

  // Return now if array is empty, or we can keep pinned version upgrades
  if (upgrades.length === 0 || config.pinVersions || !isRange(currentVersion)) {
    return upgrades;
  }

  // The user prefers to maintain ranges, so we need to unpin our upgrades
  const semverParsed = semverUtils.parseRange(currentVersion);
  if (semverParsed.length > 1) {
    // We don't know how to support complex semver ranges, so don't upgrade
    logger.warn(`Can't support upgrading complex range ${currentVersion}`);
    return [];
  }
  // We know we have a simple semver, now check which operator it is
  const currentSemver = semverParsed[0];
  // Loop through all upgrades and convert to ranges
  return _(upgrades)
  .reject(upgrade => upgrade.upgradeType === 'pin')
  .map(upgrade => Object.assign(upgrade, { isRange: true }))
  .map((upgrade) => {
    const { major, minor } = semverUtils.parse(upgrade.newVersion);
    if (currentSemver.operator === '~') {
      // Utilise that a.b is the same as ~a.b.0
      const minSatisfying = semver.minSatisfying(versionList, `${major}.${minor}`);
      // Add a tilde before that version number
      return Object.assign(upgrade, { newVersion: `~${minSatisfying}` });
    } else if (currentSemver.operator === '^') {
      // If version is < 1, then semver treats ^ same as ~
      const newRange = major === '0' ? `${major}.${minor}` : `${major}`;
      const minSatisfying = semver.minSatisfying(versionList, newRange);
      // Add in the caret
      return Object.assign(upgrade, { newVersion: `^${minSatisfying}` });
    } else if (currentSemver.operator === '<=') {
      // Example: <= 1.2.0
      return Object.assign(upgrade, { newVersion: `<= ${upgrade.newVersion}` });
    } else if (currentSemver.minor === undefined) {
      // Example: 1
      return Object.assign(upgrade, { newVersion: `${major}` });
    } else if (currentSemver.minor === 'x') {
      // Example: 1.x
      return Object.assign(upgrade, { newVersion: `${major}.x` });
    } else if (currentSemver.patch === undefined) {
      // Example: 1.2
      return Object.assign(upgrade, { newVersion: `${major}.${minor}` });
    } else if (currentSemver.patch === 'x') {
      // Example: 1.2.x
      return Object.assign(upgrade, { newVersion: `${major}.${minor}.x` });
    }
    logger.warn(`Unsupported semver type: ${currentSemver}`);
    return null;
  })
  .compact()
  .value();
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
