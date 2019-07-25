import { RangeConfig } from '../common';
import { RangeStrategy } from '../../versioning';

export function getRangeStrategy(config: RangeConfig): RangeStrategy {
  if (config.rangeStrategy === 'auto') {
    return 'pin';
  }
  return config.rangeStrategy;
}
