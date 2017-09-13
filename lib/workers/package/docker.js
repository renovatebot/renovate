const { mergeChildConfig } = require('../../config');
const { getDigest } = require('../../api/docker');

module.exports = {
  renovateDockerImage,
};

async function renovateDockerImage(config) {
  // TODO: look up digest from docker registry
  const newDigest = await getDigest(
    config.depName,
    config.currentTag,
    config.logger
  );
  if (config.currentDigest === newDigest) {
    return [];
  }
  let upgrade = { ...config };
  upgrade.newTag = upgrade.currentTag;
  upgrade.newDigest = newDigest;
  upgrade.newFrom = upgrade.depName;
  if (upgrade.newTag) {
    upgrade.newFrom += `:${upgrade.newTag}`;
  }
  upgrade.newFrom += `@${upgrade.newDigest}`;
  if (upgrade.currentDigest) {
    upgrade.type = 'digest';
    upgrade.isDigest = true;
    upgrade = mergeChildConfig(upgrade, upgrade.digest);
  } else {
    upgrade.type = 'pin';
    upgrade.isPin = true;
    upgrade = mergeChildConfig(upgrade, upgrade.pin);
  }
  return [upgrade];
}
