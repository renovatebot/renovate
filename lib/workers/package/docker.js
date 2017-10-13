const semver = require('semver');
const dockerApi = require('../../api/docker');
const versions = require('./versions');
const compareVersions = require('compare-versions');

module.exports = {
  renovateDockerImage,
};

async function renovateDockerImage(config) {
  const { currentTag, logger } = config;
  const upgrades = [];
  if (config.pinDigests) {
    const newDigest = await dockerApi.getDigest(
      config.depName,
      currentTag,
      config.logger
    );
    if (newDigest && config.currentDigest !== newDigest) {
      const upgrade = {};
      upgrade.newTag = currentTag;
      upgrade.newDigest = newDigest;
      upgrade.newVersion = newDigest;
      upgrade.newFrom = config.depName;
      if (upgrade.newTag) {
        upgrade.newFrom += `:${upgrade.newTag}`;
      }
      upgrade.newFrom += `@${upgrade.newDigest}`;
      if (config.currentDigest) {
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
    const currentVersion = getVersion(currentTag);
    const currentSuffix = getSuffix(currentTag);
    if (versions.isValidVersion(currentVersion)) {
      const versionList = (await dockerApi.getTags(
        config.depName,
        config.logger
      ))
        .filter(tag => getSuffix(tag) === currentSuffix)
        .map(tag => getVersion(tag))
        .filter(prefix => versions.isValidVersion(prefix))
        .filter(
          prefix =>
            prefix.split('.').length === currentVersion.split('.').length
        )
        .filter(prefix => compareVersions(prefix, currentVersion) > 0);
      logger.info({ versionList }, 'versionList');
      const versionUpgrades = {};
      for (const version of versionList) {
        const paddedVersion = padRange(version);
        const major = semver.major(paddedVersion);
        if (
          !versionUpgrades[major] ||
          compareVersions(version, versionUpgrades[major])
        ) {
          versionUpgrades[major] = version;
        }
      }
      logger.info({ versionUpgrades }, 'versionUpgrades');
      const currentMajor = semver.major(padRange(currentVersion));
      for (const newVersionMajor of Object.keys(versionUpgrades)) {
        const upgrade = {
          newTag: `${versionUpgrades[newVersionMajor]}-${currentSuffix}`,
          newVersionMajor,
        };
        upgrade.newVersion = upgrade.newTag;
        upgrade.newFrom = `${config.depName}:${upgrade.newTag}`;
        if (newVersionMajor > currentMajor) {
          upgrade.type = 'major';
          upgrade.isMajor = true;
        } else {
          upgrade.type = 'minor';
          upgrade.isMinor = true;
        }
        if (config.currentDigest || config.pinDigests) {
          const newDigest = await dockerApi.getDigest(
            config.depName,
            upgrade.newTag,
            config.logger
          );
          if (newDigest && config.currentDigest !== newDigest) {
            upgrade.newDigest = newDigest;
            upgrade.newFrom += `@${upgrade.newDigest}`;
          }
        }
        upgrades.push(upgrade);
      }
    }
  }
  logger.info({ upgrades }, 'Found upgrades');
  return upgrades;
}

function getVersion(tag) {
  const split = tag.indexOf('-');
  return split > 0 ? tag.substring(0, tag.indexOf('-')) : tag;
}

function getSuffix(tag) {
  const split = tag.indexOf('-');
  return split > 0 ? tag.slice(split + 1) : '';
}

function padRange(range) {
  return range + '.0'.repeat(3 - range.split('.').length);
}
