const semver = require('semver');
const dockerApi = require('../../datasource/docker');
const versions = require('../../workers/package/versions');
const compareVersions = require('compare-versions');

module.exports = {
  isStable,
  getPackageUpdates,
};

async function getPackageUpdates(config) {
  const {
    currentFrom,
    dockerRegistry,
    depName,
    currentDepTag,
    currentTag,
    currentDigest,
    unstablePattern,
    ignoreUnstable,
  } = config;
  const upgrades = [];
  if (currentDigest || config.pinDigests) {
    logger.debug('Checking docker pinDigests');
    const newDigest = await dockerApi.getDigest(
      dockerRegistry,
      depName,
      currentTag
    );
    if (!newDigest) {
      logger.info(
        { currentFrom, dockerRegistry, depName, currentTag },
        'Dockerfile no digest'
      );
      return [];
    }
    if (newDigest && config.currentDigest !== newDigest) {
      const upgrade = {};
      upgrade.newTag = currentTag || 'latest';
      upgrade.newDigest = newDigest;
      upgrade.newDigestShort = newDigest.slice(7, 13);
      if (dockerRegistry) {
        upgrade.newFrom = `${dockerRegistry}/`;
      } else {
        upgrade.newFrom = '';
      }
      upgrade.newFrom += `${depName}:${upgrade.newTag}@${newDigest}`;

      if (currentDigest) {
        upgrade.type = 'digest';
        upgrade.isDigest = true;
      } else {
        upgrade.type = 'pin';
        upgrade.isPin = true;
      }
      upgrades.push(upgrade);
    }
  }
  if (currentTag) {
    const tagVersion = getVersion(currentTag);
    const tagSuffix = getSuffix(currentTag);
    if (!versions.isValidVersion(tagVersion)) {
      logger.info(
        { currentDepTag },
        'Docker tag is not valid semver - skipping'
      );
      return upgrades;
    }
    const currentMajor = semver.major(padRange(tagVersion));
    const currentlyStable = isStable(tagVersion, unstablePattern);
    let versionList = [];
    const allTags = await dockerApi.getTags(dockerRegistry, config.depName);
    if (allTags) {
      versionList = allTags
        .filter(tag => getSuffix(tag) === tagSuffix)
        .map(getVersion)
        .filter(versions.isValidVersion)
        .filter(
          version =>
            // All stable are allowed
            isStable(version, unstablePattern) ||
            // All unstable are allowed if we aren't ignoring them
            !ignoreUnstable ||
            // Allow unstable of same major version
            (!currentlyStable &&
              semver.major(padRange(version)) === currentMajor)
        )
        .filter(
          prefix => prefix.split('.').length === tagVersion.split('.').length
        )
        .filter(prefix => compareVersions(prefix, tagVersion) > 0);
    }
    logger.trace({ versionList }, 'upgrades versionList');
    const versionUpgrades = {};
    for (const version of versionList) {
      const paddedVersion = padRange(version);
      const newVersionMajor = semver.major(paddedVersion);
      let type;
      if (newVersionMajor > currentMajor) {
        type = 'major';
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
      } else {
        // Use major version as lookup key
        upgradeKey = newVersionMajor;
      }
      if (
        !versionUpgrades[upgradeKey] ||
        compareVersions(version, versionUpgrades[upgradeKey]) > 0
      ) {
        versionUpgrades[upgradeKey] = version;
      }
    }
    logger.debug({ versionUpgrades }, 'Docker versionUpgrades');
    for (const upgradeKey of Object.keys(versionUpgrades)) {
      let newTag = versionUpgrades[upgradeKey];
      const newVersionMajor = `${semver.major(
        padRange(versionUpgrades[upgradeKey])
      )}`;
      if (tagSuffix) {
        newTag += `-${tagSuffix}`;
      }
      const upgrade = {
        newTag,
        newVersionMajor,
      };
      upgrade.newVersion = newTag;
      upgrade.newDepTag = `${config.depName}:${upgrade.newTag}`;
      if (dockerRegistry) {
        upgrade.newFrom = `${dockerRegistry}/`;
      } else {
        upgrade.newFrom = '';
      }
      upgrade.newFrom += `${depName}:${upgrade.newTag}`;
      if (config.currentDigest || config.pinDigests) {
        upgrade.newDigest = await dockerApi.getDigest(
          dockerRegistry,
          config.depName,
          upgrade.newTag
        );
        // istanbul ignore else
        if (upgrade.newDigest) {
          upgrade.newFrom += `@${upgrade.newDigest}`;
        } else {
          logger.warn(
            { dockerRegistry, depName, tag: upgrade.newTag },
            'Dockerfile no digest'
          );
          throw new Error('registry-failure');
        }
      }
      if (newVersionMajor > currentMajor) {
        upgrade.type = 'major';
        upgrade.isMajor = true;
      } else {
        upgrade.type = 'minor';
        upgrade.isMinor = true;
      }
      upgrades.push(upgrade);
      logger.info(
        { currentDepTag, newDepTag: upgrade.newDepTag },
        'Docker tag version upgrade found'
      );
    }
  }
  return upgrades.filter(u => u.newDigest !== null);
}

function isStable(tag, unstablePattern) {
  return unstablePattern
    ? tag.match(new RegExp(unstablePattern)) === null
    : true;
}

function getVersion(tag) {
  const split = tag.indexOf('-');
  return split > 0 ? tag.substring(0, split) : tag;
}

function getSuffix(tag) {
  const split = tag.indexOf('-');
  return split > 0 ? tag.slice(split + 1) : '';
}

function padRange(range) {
  return range + '.0'.repeat(3 - range.split('.').length);
}
