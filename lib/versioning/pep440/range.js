module.exports = {
  getNewValue,
};

function getNewValue(config, fromVersion, toVersion) {
  if (config.rangeStrategy === 'pin' || config.currentValue.startsWith('==')) {
    return '==' + toVersion;
  }
  logger.warn('Unsupported currentValue: ' + config.currentValue);
  return toVersion;
}
