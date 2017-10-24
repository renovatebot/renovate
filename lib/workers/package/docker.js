const dockerApi = require('../../api/docker');

module.exports = {
  renovateDockerImage,
};

async function renovateDockerImage(config) {
  const { currentTag, logger } = config;
  const upgrades = [];
  if (config.pinDigests) {
    logger.debug('Checking Docker pinDigests');
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
  return upgrades;
}
