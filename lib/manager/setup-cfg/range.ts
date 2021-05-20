import type { RangeStrategy } from '../../types';
import type { RangeConfig } from '../types';

export function getRangeStrategy(config: RangeConfig): RangeStrategy {
  return !config.rangeStrategy || config.rangeStrategy === 'auto'
    ? 'replace'
    : config.rangeStrategy;
}
