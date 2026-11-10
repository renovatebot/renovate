import type { RangeStrategy } from '../../../types/index.ts';
import type { RangeConfig } from '../types.ts';

export function getRangeStrategy({ currentValue }: RangeConfig): RangeStrategy {
  if (currentValue) {
    return 'replace';
  }

  return 'update-lockfile';
}
