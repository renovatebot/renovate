import { RangeStrategy } from '../../types';
import { RangeConfig } from '../common';

/* istanbul ignore next */
export function getRangeStrategy(_config: RangeConfig): RangeStrategy {
  return 'bump';
}
