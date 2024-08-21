import { parseRange } from 'semver-utils';
import { logger } from '../../../logger';
import type { RangeStrategy } from '../../../types';
import type { RangeConfig } from '../types';

export function getRangeStrategy(config: RangeConfig): RangeStrategy {
  const { currentValue, rangeStrategy } = config;
  const isComplexRange = currentValue
    ? parseRange(currentValue).length > 1
    : false;

  if (rangeStrategy === 'bump' && isComplexRange) {
    logger.debug(
      { currentValue },
      'Replacing bump strategy for complex range with widen',
    );
    return 'widen';
  }
  if (rangeStrategy === 'update-lockfile') {
    logger.warn(
      'Unsupported rangeStrategy update-lockfile, defaulting to widen',
    );
    return 'widen';
  }
  if (rangeStrategy === 'in-range-only') {
    logger.warn('Unsupported rangeStrategy in-range-only, defaulting to widen');
    return 'widen';
  }
  if (rangeStrategy !== 'auto') {
    return rangeStrategy;
  }
  return 'widen';
}
