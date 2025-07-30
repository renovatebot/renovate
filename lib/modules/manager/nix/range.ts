import type { RangeStrategy } from '../../../types';
import type { RangeConfig } from '../types';

export function getRangeStrategy({
  currentValue,
  depName,
  rangeStrategy,
}: RangeConfig): RangeStrategy {
  if (depName === 'nixpkgs') {
    return rangeStrategy;
  }

  if (currentValue) {
    return 'replace';
  }

  return 'update-lockfile';
}
