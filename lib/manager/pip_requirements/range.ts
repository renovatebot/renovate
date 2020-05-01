import { RangeStrategy } from '../../versioning';
import { RangeConfig } from '../common';

export function getRangeStrategy(config: RangeConfig): RangeStrategy {
  if (config.rangeStrategy === 'auto') {
    return 'pin';
  }
  return config.rangeStrategy;
}
