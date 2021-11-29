import type { RangeStrategy } from '../../types';
import type { RangeConfig } from '../types';

export function getRangeStrategy(config: RangeConfig): RangeStrategy {
  if (config.rangeStrategy === 'auto') {
    return 'pin';
  }
  return config.rangeStrategy;
}
