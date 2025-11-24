import type { RangeStrategy } from '../../../types';
import type { RangeConfig } from '../types';

export function getRangeStrategy({
  rangeStrategy,
}: RangeConfig): RangeStrategy {
  if (rangeStrategy !== 'auto') {
    return rangeStrategy;
  }

  // For APK packages, we want to preserve range constraints and only update lock files
  // This means git>2.40 stays as git>2.40, and only the lock file gets updated
  return 'update-lockfile';
}
