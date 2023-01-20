import type { RangeStrategy } from '../../../types';
import type { RangeConfig } from '../types';

export function getRangeStrategy(config: RangeConfig): RangeStrategy {
  return rangeStrategy === 'auto' ? 'bump' : rangeStrategy;
}
