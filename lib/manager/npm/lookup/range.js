const { parseRange } = require('semver-utils');

module.exports = {
  getRangeStrategy,
};

function getRangeStrategy(config) {
  const {
    depType,
    depName,
    packageJsonType,
    currentVersion,
    rangeStrategy,
  } = config;
  const isComplexRange = parseRange(currentVersion).length > 1;
  if (rangeStrategy === 'bump' && isComplexRange) {
    logger.info(
      { currentVersion },
      'Replacing bump strategy for complex range with widen'
    );
    return 'widen';
  }
  if (rangeStrategy !== 'auto') {
    return rangeStrategy;
  }
  if (depType === 'devDependencies') {
    // Always pin devDependencies
    logger.debug({ depName }, 'Pinning devDependency');
    return 'pin';
  }
  if (depType === 'dependencies' && packageJsonType === 'app') {
    // Pin dependencies if we're pretty sure it's not a browser library
    logger.debug('Pinning app dependency');
    return 'pin';
  }
  if (depType === 'peerDependencies') {
    // Widen peer dependencies
    logger.debug('Widening peer dependencies');
    return 'widen';
  }
  if (isComplexRange) {
    return 'widen';
  }
  return 'replace';
}
