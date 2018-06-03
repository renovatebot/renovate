module.exports = {
  getRangeStrategy,
};

function getRangeStrategy(config) {
  const { rangeStrategy } = config;
  // istanbul ignore if
  if (rangeStrategy === 'auto') {
    return 'pin';
  }
  return rangeStrategy;
}
