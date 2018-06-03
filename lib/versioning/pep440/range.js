module.exports = {
  rangify,
};

function rangify(config, currentVersion, fromVersion, toVersion) {
  if (currentVersion.startsWith('==')) {
    return '==' + toVersion;
  }
  logger.warn('Unknown currentVersion: ' + currentVersion);
  return toVersion;
}
