import type { RangeStrategy } from '../../../types/index.ts';
import type { RangeConfig } from '../types.ts';

export function getRangeStrategy({
  rangeStrategy,
}: RangeConfig): RangeStrategy {
  return rangeStrategy === 'auto' ? 'pin' : rangeStrategy!;
}
