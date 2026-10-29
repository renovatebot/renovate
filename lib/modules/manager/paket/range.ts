import type { RangeStrategy } from '../../../types/index.ts';
import type { RangeConfig } from '../types.ts';

export function getRangeStrategy({
  rangeStrategy,
}: RangeConfig): RangeStrategy {
  if (rangeStrategy && rangeStrategy !== 'auto') {
    return rangeStrategy;
  }
  return 'update-lockfile';
}
