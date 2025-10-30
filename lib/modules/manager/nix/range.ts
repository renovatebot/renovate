import type { RangeStrategy } from '../../../types';
import type { RangeConfig } from '../types';

export function getRangeStrategy({ currentValue }: RangeConfig): RangeStrategy {
  if (currentValue) {
    return 'replace';
  }

  return 'update-lockfile';
}
