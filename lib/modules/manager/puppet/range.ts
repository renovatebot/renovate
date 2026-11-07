import type { RangeStrategy } from '../../../types/index.ts';
import type { RangeConfig } from '../types.ts';

export function getRangeStrategy(config: RangeConfig): RangeStrategy {
  const { depType, rangeStrategy } = config;
  if (rangeStrategy !== 'auto') {
    return rangeStrategy!;
  }
  // metadata.json declares compatibility ranges, so widen them by default
  if (depType === 'dependencies') {
    return 'widen';
  }
  // Puppetfile entries are pinned versions
  return 'replace';
}
