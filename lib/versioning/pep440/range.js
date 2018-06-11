module.exports = {
  getNewValue,
};

function getNewValue(currentValue, rangeStrategy, fromVersion, toVersion) {
  if (rangeStrategy === 'pin' || currentValue.startsWith('==')) {
    return '==' + toVersion;
  }
  logger.warn('Unsupported currentValue: ' + currentValue);
  return toVersion;
}
