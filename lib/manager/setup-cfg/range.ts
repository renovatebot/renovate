import { RangeStrategy } from '../../types';
import { RangeConfig } from '../common';

export function getRangeStrategy(config: RangeConfig): RangeStrategy {
  return 'bump';
}
