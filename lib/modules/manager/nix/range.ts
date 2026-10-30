import type { RangeStrategy } from '../../../types/index.ts';
import type { RangeConfig } from '../types.ts';

export function getRangeStrategy({
  rangeStrategy,
}: RangeConfig): RangeStrategy {
  // Treat pin like auto because supported inputs do not use version ranges.
  if (rangeStrategy && rangeStrategy !== 'auto' && rangeStrategy !== 'pin') {
    return rangeStrategy;
  }

  return 'update-lockfile';
}
