import type { RangeConfig } from '../types.ts';
import { getRangeStrategy } from './index.ts';

describe('modules/manager/circleci/range', () => {
  it('returns same if not auto', () => {
    const config: RangeConfig = { rangeStrategy: 'widen' };
    expect(getRangeStrategy(config)).toBe('widen');
  });

  it('defaults to bump', () => {
    const config: RangeConfig = { rangeStrategy: 'auto', depType: 'require' };
    expect(getRangeStrategy(config)).toBe('pin');
  });
});
