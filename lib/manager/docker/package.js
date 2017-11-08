const semver = require('semver');
const dockerApi = require('./registry');
const versions = require('../../workers/package/versions');
const compareVersions = require('compare-versions');

module.exports = {
  getPackageUpdates,
};

async function getPackageUpdates(config) {
  const {
    dockerRegistry,
    currentFrom,
    depName,
    currentDepTag,
    currentTag,
    currentDigest,
  } = config;
  if (dockerRegistry) {
    logger.info({ currentFrom }, 'Skipping Dockerfile image with custom host');
    return [];
  }
  const upgrades = [];
  if (currentDigest || config.pinDigests) {
    logger.debug('Checking docker pinDigests');
    const newDigest = await dockerApi.getDigest(depName, currentTag);
    if (newDigest && config.currentDigest !== newDigest) {
      const upgrade = {};
      upgrade.newTag = currentTag || 'latest';
      upgrade.newDigest = newDigest;
      upgrade.newDigestShort = newDigest.slice(7, 13);
      upgrade.newFrom = `${depName}:${upgrade.newTag}@${newDigest}`;
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
    let versionList = [];
    const allTags = await dockerApi.getTags(config.depName);
    if (allTags) {
      versionList = allTags
        .filter(tag => getSuffix(tag) === tagSuffix)
        .map(getVersion)
        .filter(versions.isValidVersion)
        .filter(
          prefix => prefix.split('.').length === tagVersion.split('.').length
        )
        .filter(prefix => compareVersions(prefix, tagVersion) > 0);
    }
    logger.debug({ versionList }, 'upgrades versionList');
    const versionUpgrades = {};
    for (const version of versionList) {
      const paddedVersion = padRange(version);
      const major = semver.major(paddedVersion);
      if (
        !versionUpgrades[major] ||
        compareVersions(version, versionUpgrades[major]) > 0
      ) {
        versionUpgrades[major] = version;
      }
    }
    logger.debug({ versionUpgrades }, 'Docker versionUpgrades');
    const currentMajor = semver.major(padRange(tagVersion));
    for (const newVersionMajor of Object.keys(versionUpgrades)) {
      let newTag = versionUpgrades[newVersionMajor];
      if (tagSuffix) {
        newTag += `-${tagSuffix}`;
      }
      const upgrade = {
        newTag,
        newVersionMajor,
      };
      upgrade.newVersion = newTag;
      upgrade.newDepTag = `${config.depName}:${upgrade.newTag}`;
      let newFrom = upgrade.newDepTag;
      if (config.currentDigest || config.pinDigests) {
        upgrade.newDigest = await dockerApi.getDigest(
          config.depName,
          upgrade.newTag
        );
        newFrom = `${newFrom}@${upgrade.newDigest}`;
      }
      upgrade.newFrom = newFrom;
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
  return upgrades;
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
