const dockerApi = require('../../api/docker');

module.exports = {
  renovateDockerImage,
};

async function renovateDockerImage(config) {
  const newDigest = await dockerApi.getDigest(
    config.depName,
    config.currentTag,
    config.logger
  );
  if (!newDigest || config.currentDigest === newDigest) {
    return [];
  }
  const upgrade = {};
  upgrade.newTag = config.currentTag;
  upgrade.newDigest = newDigest;
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
  return [upgrade];
}
