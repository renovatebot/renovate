module.exports = {
  getNewValue,
};

function getNewValue(config, currentValue, fromVersion, toVersion) {
  const { rangeStrategy } = config;
  // istanbul ignore if
  if (rangeStrategy !== 'pin') {
    logger.warn({ rangeStrategy }, 'Unsupported rangeStrategy');
    return null;
  }
  return toVersion;
}
