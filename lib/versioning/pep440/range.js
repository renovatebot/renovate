module.exports = {
  getNewValue,
};

function getNewValue(config, currentValue, fromVersion, toVersion) {
  if (currentValue.startsWith('==')) {
    return '==' + toVersion;
  }
  logger.warn('Unsupported currentValue: ' + currentValue);
  return toVersion;
}
