import { RangeStrategy } from '../../types';
import { RangeConfig } from '../common';

export function getRangeStrategy(config: RangeConfig): RangeStrategy {
  return !config.rangeStrategy || config.rangeStrategy === 'auto'
    ? 'replace'
    : config.rangeStrategy;
}
