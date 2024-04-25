import { parseRange } from 'semver-utils';
import { logger } from '../../../logger';
import type { RangeStrategy } from '../../../types';
import type { RangeConfig } from '../types';

export function getRangeStrategy(config: RangeConfig): RangeStrategy {
  const { depType, currentValue, rangeStrategy } = config;
  // TODO #22198
  const isComplexRange = parseRange(currentValue!).length > 1;
  if (rangeStrategy === 'bump' && isComplexRange) {
    logger.debug(
      { currentValue },
      'Replacing bump strategy for complex range with widen',
    );
    return 'widen';
  }
  if (rangeStrategy !== 'auto') {
    return rangeStrategy;
  }
  if (depType === 'peerDependencies') {
    // Widen peer dependencies
    logger.debug('Widening peer dependencies');
    return 'widen';
  }
  if (isComplexRange) {
    return 'widen';
  }
  return 'update-lockfile';
}
