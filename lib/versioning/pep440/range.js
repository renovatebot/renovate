const { valid } = require('@renovate/pep440');

module.exports = {
  rangify,
};

function rangify(config, currentVersion, fromVersion, toVersion) {
  let { rangeStrategy } = config;
  if (rangeStrategy === 'auto') {
    rangeStrategy = 'pin';
  }
  if (rangeStrategy === 'pin' || valid(currentVersion)) {
    return toVersion;
  }
  logger.warn({ rangeStrategy }, 'Unsupported rangeStrategy');
  return null;
}
