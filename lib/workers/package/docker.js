const { mergeChildConfig } = require('../../config');

module.exports = {
  renovateDockerImage,
};

async function renovateDockerImage(config) {
  // TODO: look up digest from docker registry
  if (config.currentDigest === 'sha:abcdefghhhhhijklmnopqrst') {
    return [];
  }
  let upgrade = { ...config };
  upgrade.newTag = upgrade.currentTag;
  upgrade.newDigest = 'sha:abcdefghhhhhijklmnopqrst';
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
