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
  const dependency = npmDep.name;
  logger.debug({ dependency }, `determineUpgrades()`);
  logger.trace({ npmDep, config });
  const result = {
    type: 'warning',
  };
  const { lockedVersion, pinVersions, allowedVersions } = config;
  const { versions } = npmDep;
  if (!versions || Object.keys(versions).length === 0) {
    result.message = `No versions returned from registry for this package`;
    logger.warn({ dependency }, result.message);
    return [result];
  }
  const versionList = Object.keys(versions);
  const allUpgrades = {};
  let { currentVersion } = config;
  let rangeOperator;
  if (config.upgradeInRange && semver.validRange(currentVersion)) {
    logger.debug({ currentVersion }, 'upgradeInRange is true');
    const parsedRange = semverUtils.parseRange(currentVersion);
    if (parsedRange && parsedRange.length === 1) {
      const [range] = parsedRange;
      if (range.major && range.minor && range.patch) {
        if (range.operator === '^' || range.operator === '~') {
          logger.debug('Applying upgradeInRange');
          currentVersion = `${range.major}.${range.minor}.${range.patch}`;
          rangeOperator = range.operator;
        } else {
          logger.debug({ currentVersion }, 'Unsupported range type');
        }
      } else {
        logger.debug({ currentVersion }, 'Range is not fully specified');
      }
    } else {
      logger.debug({ currentVersion }, 'Skipping complex range');
    }
  }
  let changeLogFromVersion = currentVersion;
  // Check for a current range and pin it
  if (isRange(currentVersion)) {
    let newVersion;
    if (pinVersions && lockedVersion && semver.valid(lockedVersion)) {
      newVersion = lockedVersion;
    } else {
      // Pin ranges to their maximum satisfying version
      logger.debug({ dependency }, 'currentVersion is range, not locked');
      const maxSatisfying = semver.maxSatisfying(versionList, currentVersion);
      if (!maxSatisfying) {
        result.message = `No satisfying version found for existing dependency range "${currentVersion}"`;
        logger.info(
          { dependency, currentVersion },
          `Warning: ${result.message}`
        );
        return [result];
      }
      logger.debug({ dependency, maxSatisfying });
      newVersion = maxSatisfying;
    }

    allUpgrades.pin = {
      type: 'pin',
      isPin: true,
      newVersion,
      newVersionMajor: semver.major(newVersion),
    };
    changeLogFromVersion = newVersion;
  } else if (versionList.indexOf(currentVersion) === -1 && !rangeOperator) {
    logger.debug({ dependency }, 'Cannot find currentVersion');
    try {
      const rollbackVersion = semver.maxSatisfying(
        versionList,
        `<${currentVersion}`
      );
      allUpgrades.rollback = {
        type: 'rollback',
        isRollback: true,
        newVersion: rollbackVersion,
        newVersionMajor: semver.major(rollbackVersion),
        semanticCommitType: 'fix',
        branchName:
          '{{{branchPrefix}}}rollback-{{{depNameSanitized}}}-{{{newVersionMajor}}}.x',
      };
    } catch (err) /* istanbul ignore next */ {
      logger.info(
        { dependency, currentVersion },
        'Warning: current version is missing from npm registry and cannot roll back'
      );
    }
  }
  _(versionList)
    // Filter out older versions as we can't upgrade to those
    .filter(version => semver.gt(version, changeLogFromVersion))
    // fillter out non-allowed versions if preference is set
    .reject(
      version => allowedVersions && !semver.satisfies(version, allowedVersions)
    )
    // Ignore unstable versions, unless the current version is unstable
    .reject(
      version =>
        config.ignoreUnstable &&
        stable.is(changeLogFromVersion) &&
        !stable.is(version)
    )
    // Do not jump to a new major unstable just because the current is unstable
    .reject(
      version =>
        config.ignoreUnstable &&
        !stable.is(version) &&
        semver.major(version) > semver.major(changeLogFromVersion)
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
      const hasPatchOnlyAutomerge =
        config.patch &&
        config.patch.automerge === true &&
        (config.minor && config.minor.automerge !== true);
      let type;
      if (newVersionMajor > semver.major(changeLogFromVersion)) {
        type = 'major';
      } else if (
        newVersionMinor === semver.minor(changeLogFromVersion) &&
        (config.separatePatchReleases || hasPatchOnlyAutomerge)
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
      } else if (!config.multipleMajorPrs && type === 'major') {
        upgradeKey = 'major';
      } else if (type === 'patch') {
        upgradeKey = `{{{newVersionMajor}}}.{{{newVersionMinor}}}`;
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
        logger.debug({ allUpgrades });
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
  let upgrades = Object.keys(allUpgrades).map(key => allUpgrades[key]);
  for (const upgrade of upgrades) {
    const version = versions[upgrade.newVersion];
    const elapsed = version ? moment().diff(moment(version.time), 'days') : 999;
    upgrade.unpublishable = elapsed > 0;
  }

  // Return now if array is empty, or we can keep pinned version upgrades
  if (upgrades.length === 0 || config.pinVersions || !isRange(currentVersion)) {
    logger.debug({ upgrades });
    return rangeOperator
      ? upgrades.map(upgrade => ({
          ...upgrade,
          newVersion: `${rangeOperator}${upgrade.newVersion}`,
          isRange: true,
        }))
      : upgrades;
  }

  logger.debug({ dependency }, 'User wanrs ranges - filtering out pins');
  upgrades = upgrades.filter(upgrade => upgrade.type !== 'pin');

  // Return empty if all results were pins
  if (!upgrades.length) {
    logger.debug({ dependency }, 'No upgrades left - returning');
    return [];
  }

  // Check if it's a range type we support
  const semverParsed = semverUtils.parseRange(currentVersion);
  // Check the "last" part, which is also the first and only if it's a simple semver
  const [lastSemver] = semverParsed.slice(-1);
  const secondLastSemver = semverParsed[semverParsed.length - 2];
  if (semverParsed.length > 1) {
    if (lastSemver.operator === '<' || lastSemver.operator === '<=') {
      logger.debug({ dependency }, 'Found less than range');
    } else if (secondLastSemver.operator === '||') {
      logger.debug({ dependency }, 'Found an OR range');
    } else if (secondLastSemver.operator === '-') {
      logger.info(
        { dependency, currentVersion, upgrades, semverParsed },
        'Found a hyphen range'
      );
    } else {
      // We don't know how to support complex semver ranges, so don't upgrade
      result.message = `Complex semver ranges such as "${currentVersion}" are not yet supported so will be skipped`;
      logger.info(
        { dependency, upgrades, semverParsed },
        'Semver warning: ' + result.message
      );
      return [result];
    }
  }
  // Loop through all upgrades and convert to ranges
  const rangedUpgrades = _(upgrades)
    .map(upgrade => ({ ...upgrade, ...{ isRange: true } }))
    .map(upgrade => {
      const { major, minor } = semverUtils.parse(upgrade.newVersion);
      const canReplace = config.versionStrategy !== 'widen';
      const forceReplace = config.versionStrategy === 'replace';
      const canWiden = config.versionStrategy !== 'replace';
      const forceWiden = config.versionStrategy === 'widen';
      if (
        lastSemver.operator === '~' &&
        canReplace &&
        (semverParsed.length === 1 || forceReplace)
      ) {
        // Utilise that a.b is the same as ~a.b.0
        const minSatisfying = semver.minSatisfying(
          versionList,
          `${major}.${minor}`
        );
        // Add a tilde before that version number
        return { ...upgrade, ...{ newVersion: `~${minSatisfying}` } };
      } else if (
        lastSemver.operator === '~' &&
        canWiden &&
        (semverParsed.length > 1 || forceWiden)
      ) {
        // Utilise that a.b is the same as ~a.b.0
        const minSatisfying = semver.minSatisfying(
          versionList,
          `${major}.${minor}`
        );
        // Add a tilde before that version number
        const newVersion = `${currentVersion} || ~${minSatisfying}`;
        return {
          ...upgrade,
          newVersion,
        };
      } else if (
        lastSemver.operator === '^' &&
        canReplace &&
        (semverParsed.length === 1 || forceReplace)
      ) {
        let newVersion;
        // Special case where major and minor are 0
        if (major === '0' && minor === '0') {
          newVersion = `^${upgrade.newVersion}`;
        } else {
          // If version is < 1, then semver treats ^ same as ~
          const newRange = major === '0' ? `${major}.${minor}` : `${major}`;
          const minSatisfying = semver.minSatisfying(versionList, newRange);
          // Add in the caret
          newVersion = `^${minSatisfying}`;
        }
        return { ...upgrade, newVersion };
      } else if (
        lastSemver.operator === '^' &&
        canWiden &&
        (semverParsed.length > 1 || forceWiden)
      ) {
        // If version is < 1, then semver treats ^ same as ~
        const newRange = major === '0' ? `${major}.${minor}` : `${major}`;
        const minSatisfying = semver.minSatisfying(versionList, newRange);
        // Add in the caret
        const newVersion = `${currentVersion} || ^${minSatisfying}`;
        return {
          ...upgrade,
          newVersion,
        };
      } else if (lastSemver.operator === '<=') {
        const minorZero = !lastSemver.minor || lastSemver.minor === '0';
        const patchZero = !lastSemver.patch || lastSemver.patch === '0';
        const newRange = [...semverParsed];
        if (minorZero && patchZero) {
          logger.debug({ dependency }, 'Found a less than major');
          newRange[newRange.length - 1].major = String(
            upgrade.newVersionMajor + 1
          );
        } else if (patchZero) {
          logger.debug({ dependency }, 'Found a less than minor');
          newRange[newRange.length - 1].major = String(upgrade.newVersionMajor);
          newRange[newRange.length - 1].minor = String(
            upgrade.newVersionMinor + 1
          );
        } else {
          logger.debug({ dependency }, 'Found a less than full semver');
          newRange[newRange.length - 1].major = String(upgrade.newVersionMajor);
          newRange[newRange.length - 1].minor = String(upgrade.newVersionMinor);
          newRange[newRange.length - 1].patch = String(
            semver.patch(upgrade.newVersion)
          );
        }
        let newVersion = semverUtils.stringifyRange(newRange);
        newVersion = fixRange(newVersion, lastSemver, currentVersion);
        return { ...upgrade, newVersion };
      } else if (lastSemver.operator === '<') {
        const minorZero = !lastSemver.minor || lastSemver.minor === '0';
        const patchZero = !lastSemver.patch || lastSemver.patch === '0';
        const newRange = [...semverParsed];
        if (minorZero && patchZero) {
          logger.debug({ dependency }, 'Found a less than major');
          newRange[newRange.length - 1].major = String(
            upgrade.newVersionMajor + 1
          );
        } else if (patchZero) {
          logger.debug({ dependency }, 'Found a less than minor');
          newRange[newRange.length - 1].major = String(upgrade.newVersionMajor);
          newRange[newRange.length - 1].minor = String(
            upgrade.newVersionMinor + 1
          );
        } else {
          logger.debug({ dependency }, 'Found full semver minor');
          newRange[newRange.length - 1].major = String(upgrade.newVersionMajor);
          newRange[newRange.length - 1].minor = String(upgrade.newVersionMinor);
          newRange[newRange.length - 1].patch = String(
            semver.patch(upgrade.newVersion) + 1
          );
        }
        let newVersion = semverUtils.stringifyRange(newRange);
        newVersion = fixRange(newVersion, lastSemver, currentVersion);
        return { ...upgrade, newVersion };
      } else if (lastSemver.minor === undefined) {
        // Example: 1
        const newRange = [...semverParsed];
        logger.debug({ dependency }, 'Found a standalone major');
        newRange[newRange.length - 1].major = String(upgrade.newVersionMajor);
        let newVersion;
        if (secondLastSemver && secondLastSemver.operator === '||') {
          newVersion = `${currentVersion} || ${upgrade.newVersionMajor}`;
        } else {
          newVersion = semverUtils.stringifyRange(newRange);
          // Fixes a bug with semver-utils
          newVersion = newVersion.replace(/\.0/g, '');
        }
        return { ...upgrade, newVersion };
      } else if (lastSemver.minor === 'x') {
        // Example: 1.x
        const newRange = [...semverParsed];
        logger.debug({ dependency }, 'Found a .x');
        newRange[newRange.length - 1].major = String(upgrade.newVersionMajor);
        let newVersion;
        if (secondLastSemver && secondLastSemver.operator === '||') {
          newVersion = `${currentVersion} || ${upgrade.newVersionMajor}.x`;
        } else {
          newVersion = semverUtils.stringifyRange(newRange);
          // Fixes a bug with semver-utils
          newVersion = newVersion.replace(/\.0/g, '');
        }
        return { ...upgrade, newVersion };
      } else if (lastSemver.patch === undefined) {
        // Example: 1.2
        return { ...upgrade, ...{ newVersion: `${major}.${minor}` } };
      } else if (lastSemver.patch === 'x' && semverParsed.length === 1) {
        // Example: 1.2.x
        return { ...upgrade, ...{ newVersion: `${major}.${minor}.x` } };
      }
      // istanbul ignore next
      result.message = `The current semver range "${currentVersion}" is not supported so won't ever be upgraded`;
      // istanbul ignore next
      logger.warn({ dependency }, result.message);
      // istanbul ignore next
      return null;
    })
    .compact()
    .value();
  // istanbul ignore if
  if (result.message) {
    // There must have been an error converting to ranges
    return [result];
  }
  return rangedUpgrades;
}

function fixRange(version, lastSemver, currentVersion) {
  let newVersion = version;
  if (!lastSemver.patch) {
    newVersion = newVersion.replace(/\.0$/, '');
  }
  if (!currentVersion.includes('< ')) {
    newVersion = newVersion.replace(/< /g, '<');
  }
  if (!currentVersion.includes('> ')) {
    newVersion = newVersion.replace(/> /g, '>');
  }
  if (!currentVersion.includes('>= ')) {
    newVersion = newVersion.replace(/>= /g, '>=');
  }
  if (!currentVersion.includes('<= ')) {
    newVersion = newVersion.replace(/<= /g, '<=');
  }
  return newVersion;
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
