import type { RangeConfig } from '../types';
import { getRangeStrategy } from './range';

describe('modules/manager/conan/range', () => {
  it('returns same if not auto', () => {
    const config: RangeConfig = { rangeStrategy: 'widen' };
    expect(getRangeStrategy(config)).toBe('widen');
  });

  it('defaults to bump', () => {
    const config: RangeConfig = { rangeStrategy: 'auto', depType: 'require' };
    expect(getRangeStrategy(config)).toBe('bump');
  });
});
