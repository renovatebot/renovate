let logger = require('../../logger');
const semver = require('semver');
const stable = require('semver-stable');
const _ = require('lodash');
const semverUtils = require('semver-utils');
const moment = require('moment');

module.exports = {
  determineUpgrades,
  isRange,
  isValidVersion,
  isPastLatest,
};

function determineUpgrades(npmDep, config) {
  logger = config.logger || logger;
  const result = {
    type: 'warning',
  };
  const { currentVersion } = config;
  const { versions } = npmDep;
  if (!versions || Object.keys(versions).length === 0) {
    result.message = `No versions returned from registry for this package`;
    logger.warn(result.message);
    return [result];
  }
  const versionList = Object.keys(versions);
  const allUpgrades = {};
  let changeLogFromVersion = currentVersion;
  // Check for a current range and pin it
  if (isRange(currentVersion)) {
    // Pin ranges to their maximum satisfying version
    const maxSatisfying = semver.maxSatisfying(versionList, currentVersion);
    allUpgrades.pin = {
      type: 'pin',
      isPin: true,
      newVersion: maxSatisfying,
      newVersionMajor: semver.major(maxSatisfying),
    };
    changeLogFromVersion = maxSatisfying;
  } else if (versionList.indexOf(currentVersion) === -1) {
    const rollbackVersion = semver.maxSatisfying(
      versionList,
      `<${currentVersion}`
    );
    allUpgrades.rollback = {
      type: 'rollback',
      isRollback: true,
      newVersion: rollbackVersion,
      newVersionMajor: semver.major(rollbackVersion),
      semanticPrefix: 'fix(deps):',
      branchName:
        '{{branchPrefix}}rollback-{{depNameSanitized}}-{{newVersionMajor}}.x',
    };
  }
  _(versionList)
    // Filter out older versions as we can't upgrade to those
    .filter(version => semver.gt(version, changeLogFromVersion))
    // Ignore unstable versions, unless the current version is unstable
    .reject(
      version =>
        config.ignoreUnstable &&
        stable.is(changeLogFromVersion) &&
        !stable.is(version)
    )
    // Ignore versions newer than "latest", unless current version is newer than the "latest"
    .reject(
      version =>
        config.respectLatest &&
        isPastLatest(npmDep, version) &&
        !isPastLatest(npmDep, changeLogFromVersion)
    )
    // Loop through all possible versions
    .forEach(newVersion => {
      // Group by major versions
      const newVersionMajor = semver.major(newVersion);
      const newVersionMinor = semver.minor(newVersion);
      const hasPatchAutomerge = config.patch && config.patch.automerge === true;
      let type;
      if (newVersionMajor > semver.major(changeLogFromVersion)) {
        type = 'major';
      } else if (
        newVersionMinor === semver.minor(changeLogFromVersion) &&
        (config.separatePatchReleases || hasPatchAutomerge)
      ) {
        // Only use patch if configured to
        type = 'patch';
      } else {
        type = 'minor';
      }
      let upgradeKey;
      if (
        !config.separateMajorReleases ||
        config.groupName ||
        config.major.automerge === true
      ) {
        // If we're not separating releases then we use a common lookup key
        upgradeKey = 'latest';
      } else if (type === 'patch') {
        upgradeKey = `{{newVersionMajor}}.{{newVersionMinor}}`;
      } else {
        // Use major version as lookup key
        upgradeKey = newVersionMajor;
      }
      // Save this, if it's a new major version or greater than the previous greatest
      if (
        !allUpgrades[upgradeKey] ||
        semver.gt(newVersion, allUpgrades[upgradeKey].newVersion)
      ) {
        const changeLogToVersion = newVersion;
        allUpgrades[upgradeKey] = {
          type,
          newVersion,
          newVersionMajor,
          newVersionMinor,
          changeLogFromVersion,
          changeLogToVersion,
        };
        if (type === 'major') {
          allUpgrades[upgradeKey].isMajor = true;
        } else if (type === 'minor') {
          allUpgrades[upgradeKey].isMinor = true;
        } else if (type === 'patch') {
          allUpgrades[upgradeKey].isPatch = true;
        }
      }
    });
  // Return only the values - we don't need the keys anymore
  const upgrades = Object.keys(allUpgrades).map(key => allUpgrades[key]);
  for (const upgrade of upgrades) {
    const elapsed = moment().diff(
      moment(versions[upgrade.newVersion].time),
      'days'
    );
    upgrade.unpublishable = elapsed > 0;
  }

  // Return now if array is empty, or we can keep pinned version upgrades
  if (upgrades.length === 0 || config.pinVersions || !isRange(currentVersion)) {
    return upgrades;
  }

  // The user prefers to maintain ranges, so we need to unpin our upgrades
  const semverParsed = semverUtils.parseRange(currentVersion);
  if (semverParsed.length > 1) {
    // We don't know how to support complex semver ranges, so don't upgrade
    result.message = `Complex semver ranges such as "${currentVersion}" are not yet supported so won't ever be upgraded`;
    logger.warn(result.message);
    return [result];
  }
  // We know we have a simple semver, now check which operator it is
  const currentSemver = semverParsed[0];
  // Loop through all upgrades and convert to ranges
  const rangedUpgrades = _(upgrades)
    .reject(upgrade => upgrade.type === 'pin')
    .map(upgrade => ({ ...upgrade, ...{ isRange: true } }))
    .map(upgrade => {
      const { major, minor } = semverUtils.parse(upgrade.newVersion);
      if (currentSemver.operator === '~') {
        // Utilise that a.b is the same as ~a.b.0
        const minSatisfying = semver.minSatisfying(
          versionList,
          `${major}.${minor}`
        );
        // Add a tilde before that version number
        return { ...upgrade, ...{ newVersion: `~${minSatisfying}` } };
      } else if (currentSemver.operator === '^') {
        // Special case where major and minor are 0
        if (major === '0' && minor === '0') {
          return {
            ...upgrade,
            ...{
              newVersion: `^${upgrade.newVersion}`,
            },
          };
        }
        // If version is < 1, then semver treats ^ same as ~
        const newRange = major === '0' ? `${major}.${minor}` : `${major}`;
        const minSatisfying = semver.minSatisfying(versionList, newRange);
        // Add in the caret
        return { ...upgrade, ...{ newVersion: `^${minSatisfying}` } };
      } else if (currentSemver.operator === '<=') {
        // Example: <= 1.2.0
        return {
          ...upgrade,
          ...{
            newVersion: `<= ${upgrade.newVersion}`,
          },
        };
      } else if (currentSemver.minor === undefined) {
        // Example: 1
        return { ...upgrade, ...{ newVersion: `${major}` } };
      } else if (currentSemver.minor === 'x') {
        // Example: 1.x
        return { ...upgrade, ...{ newVersion: `${major}.x` } };
      } else if (currentSemver.patch === undefined) {
        // Example: 1.2
        return { ...upgrade, ...{ newVersion: `${major}.${minor}` } };
      } else if (currentSemver.patch === 'x') {
        // Example: 1.2.x
        return { ...upgrade, ...{ newVersion: `${major}.${minor}.x` } };
      }
      result.message = `The current semver range "${currentVersion}" is not supported so won't ever be upgraded`;
      logger.warn(result.message);
      return null;
    })
    .compact()
    .value();
  if (result.message) {
    // There must have been an error converting to ranges
    return [result];
  }
  return rangedUpgrades;
}

function isRange(input) {
  // Pinned versions also return true for semver.validRange
  // We need to check first that they're not 'valid' to get only ranges
  return semver.valid(input) === null && semver.validRange(input) !== null;
}

function isValidVersion(input) {
  return (semver.valid(input) || semver.validRange(input)) !== null;
}

function isPastLatest(npmDep, version) {
  if (npmDep['dist-tags'] && npmDep['dist-tags'].latest) {
    return semver.gt(version, npmDep['dist-tags'].latest);
  }
  logger.warn(`No dist-tags.latest for ${npmDep.name}`);
  return false;
}
