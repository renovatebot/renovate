import { parseRange } from 'semver-utils';
import { logger } from '../../logger';
import { RangeConfig } from '../common';
import { RangeStrategy } from '../../versioning';
import {
  DEP_TYPE_DEPENDENCY,
  DEP_TYPE_DEV,
  DEP_TYPE_PEER,
} from '../../constants/dependency';

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
  if (depType === DEP_TYPE_DEV) {
    // Always pin devDependencies
    logger.trace({ dependency: depName }, 'Pinning devDependency');
    return 'pin';
  }
  if (depType === DEP_TYPE_DEPENDENCY && packageJsonType === 'app') {
    // Pin dependencies if we're pretty sure it's not a browser library
    logger.trace({ dependency: depName }, 'Pinning app dependency');
    return 'pin';
  }
  if (depType === DEP_TYPE_PEER) {
    // Widen peer dependencies
    logger.debug('Widening peer dependencies');
    return 'widen';
  }
  if (isComplexRange) {
    return 'widen';
  }
  return 'replace';
}
