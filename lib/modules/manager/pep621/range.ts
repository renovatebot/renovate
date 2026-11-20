import type { RangeStrategy } from '../../../types/index.ts';
import type { RangeConfig } from '../types.ts';

/**
 * Returns `replace` for `auto`, `update-lockfile` for `in-range-only`, and the given range strategy otherwise.
 */
export function getRangeStrategy({
  rangeStrategy,
}: RangeConfig): RangeStrategy {
  if (rangeStrategy === 'auto') {
    return 'replace';
  }
  if (rangeStrategy === 'in-range-only') {
    return 'update-lockfile';
  }
  return rangeStrategy!;
}
