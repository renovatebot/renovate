import { parseRange } from 'semver-utils';
import { logger } from '../../logger';
import { RangeConfig } from '../common';
import { RangeStrategy } from '../../versioning';

export function getRangeStrategy(config: RangeConfig): RangeStrategy {
  const {
    depType,
    depName,
    packageJsonType,
    currentValue,
    rangeStrategy,
  } = config;
  const isComplexRange = parseRange(currentValue).length > 1;
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
  if (depType === 'devDependencies') {
    // Always pin devDependencies
    logger.trace({ dependency: depName }, 'Pinning devDependency');
    return 'pin';
  }
  if (depType === 'dependencies' && packageJsonType === 'app') {
    // Pin dependencies if we're pretty sure it's not a browser library
    logger.trace({ dependency: depName }, 'Pinning app dependency');
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
