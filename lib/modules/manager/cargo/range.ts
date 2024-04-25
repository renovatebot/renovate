import type { RangeStrategy } from '../../../types';
import type { RangeConfig } from '../types';

export function getRangeStrategy({
  currentValue,
  rangeStrategy,
}: RangeConfig): RangeStrategy {
  if (rangeStrategy !== 'auto') {
    return rangeStrategy;
  }
  if (currentValue?.includes('<')) {
    return 'widen';
  }
  return 'bump';
}
