module.exports = {
  getRangeStrategy,
};

function getRangeStrategy(config) {
  const { depType, depName, currentValue, rangeStrategy } = config;
  const isComplexRange = currentValue && currentValue.includes(' || ');
  if (rangeStrategy === 'bump' && isComplexRange) {
    logger.info(
      { currentValue },
      'Replacing bump strategy for complex range with widen'
    );
    return 'widen';
  }
  if (rangeStrategy !== 'auto') {
    return rangeStrategy;
  }
  if (depType === 'require-dev') {
    // Always pin dev dependencies
    logger.trace({ dependency: depName }, 'Pinning require-dev');
    return 'pin';
  }
  if (isComplexRange) {
    return 'widen';
  }
  return 'replace';
}
