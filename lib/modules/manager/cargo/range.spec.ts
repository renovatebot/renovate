import type { RangeConfig } from '../types';
import { getRangeStrategy } from '.';

describe('modules/manager/cargo/range', () => {
  it('returns same if not auto', () => {
    const config: RangeConfig = { rangeStrategy: 'widen' };
    expect(getRangeStrategy(config)).toBe('widen');
  });

  it('returns widen if current value includes <', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      currentValue: '<1.0.0',
    };
    expect(getRangeStrategy(config)).toBe('widen');
  });

  it('defaults to bump', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      currentValue: '1.0.0',
    };
    expect(getRangeStrategy(config)).toBe('bump');
  });
});
