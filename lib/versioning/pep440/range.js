module.exports = {
  rangify,
};

function rangify(config, currentVersion, fromVersion, toVersion) {
  const { rangeStrategy } = config;
  // istanbul ignore if
  if (rangeStrategy !== 'pin') {
    logger.warn({ rangeStrategy }, 'Unsupported rangeStrategy');
    return null;
  }
  return toVersion;
}
