import type { RangeStrategy } from '../../../types';
import type { RangeConfig } from '../types';

export function getRangeStrategy({
  rangeStrategy,
}: RangeConfig): RangeStrategy {
  return rangeStrategy === 'auto' ? 'pin' : rangeStrategy;
}
