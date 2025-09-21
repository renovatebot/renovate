import type { RangeStrategy } from '../../../types';
import type { RangeConfig } from '../types';

export function getRangeStrategy({
  rangeStrategy,
}: RangeConfig): RangeStrategy {
  if (rangeStrategy !== 'auto') {
    return rangeStrategy;
  }

  // For APK packages, we want to suggest patch updates (e.g., 5.2.37-r0 -> 5.2.37-r33)
  // and minor updates (e.g., 5.2.37-r0 -> 5.3-r3), not just the latest version
  return 'replace';
}
