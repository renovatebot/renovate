const versioning = require('../../versioning');
const dockerApi = require('../../datasource/docker');
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
    currentValue,
    tagSuffix,
    currentDigest,
    unstablePattern,
    ignoreUnstable,
  } = config;
  logger.debug(`getPackageUpdate(${currentFrom}`);
  const { getMajor, isValid } = versioning('semver');
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
      upgrade.newValue = upgrade.newDigestShort;
      if (dockerRegistry) {
        upgrade.newFrom = `${dockerRegistry}/`;
      } else {
        upgrade.newFrom = '';
      }
      upgrade.newFrom += `${depName}:${upgrade.newTag}@${newDigest}`;

      if (currentDigest) {
        upgrade.type = 'digest';
      } else {
        upgrade.type = 'pin';
      }
      upgrades.push(upgrade);
    }
  }
  if (currentTag) {
    if (!(currentValue && currentValue.length && isValid(currentValue))) {
      logger.info(
        { currentDepTag },
        'Docker tag is not valid semver - skipping'
      );
      return upgrades.map(upgrade => ({ ...upgrade, isRange: true }));
    }
    const currentMajor = getMajor(currentValue);
    const currentlyStable = isStable(currentValue, unstablePattern);
    let versionList = [];
    const allTags = await dockerApi.getTags(
      dockerRegistry,
      config.depName,
      tagSuffix
    );
    if (allTags) {
      versionList = allTags
        .filter(
          version =>
            // All stable are allowed
            isStable(version, unstablePattern) ||
            // All unstable are allowed if we aren't ignoring them
            !ignoreUnstable ||
            // Allow unstable of same major version
            (!currentlyStable && getMajor(version) === currentMajor)
        )
        .filter(
          prefix => prefix.split('.').length === currentValue.split('.').length
        )
        .filter(prefix => compareVersions(prefix, currentValue) > 0);
    }
    logger.trace({ versionList }, 'upgrades versionList');
    const versionUpgrades = {};
    for (const version of versionList) {
      const newMajor = getMajor(version);
      const type = newMajor > currentMajor ? 'major' : 'minor';
      let upgradeKey;
      if (
        !config.separateMajorMinor ||
        config.groupName ||
        config.major.automerge === true
      ) {
        // If we're not separating releases then we use a common lookup key
        upgradeKey = 'latest';
      } else if (!config.separateMultipleMajor && type === 'major') {
        upgradeKey = 'major';
      } else {
        // Use major version as lookup key
        upgradeKey = newMajor;
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
      const upgrade = {};
      const newVersion = versionUpgrades[upgradeKey];
      upgrade.newMajor = `${getMajor(newVersion)}`;
      upgrade.newTag = tagSuffix ? `${newVersion}-${tagSuffix}` : newVersion;
      upgrade.newValue = newVersion;
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
      if (upgrade.newMajor > currentMajor) {
        upgrade.type = 'major';
      } else {
        upgrade.type = 'minor';
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
