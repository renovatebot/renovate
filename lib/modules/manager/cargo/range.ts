import type { RangeStrategy } from '../../../types/index.ts';
import type { RangeConfig } from '../types.ts';

export function getRangeStrategy({
  currentValue,
  rangeStrategy,
}: RangeConfig): RangeStrategy {
  if (rangeStrategy !== 'auto') {
    return rangeStrategy!;
  }
  if (currentValue?.includes('<')) {
    return 'widen';
  }
  return 'update-lockfile';
}
