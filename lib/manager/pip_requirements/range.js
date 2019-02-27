module.exports = {
  getRangeStrategy,
};

function getRangeStrategy(config) {
  if (config.rangeStrategy === 'auto') {
    return 'pin';
  }
  return config.rangeStrategy;
}
