import type { RangeConfig } from '../types';
import { getRangeStrategy } from '.';

describe('modules/manager/gleam/range', () => {
  it('returns same if not auto', () => {
    const config: RangeConfig = { rangeStrategy: 'pin' };
    expect(getRangeStrategy(config)).toBe('pin');
  });

  it('widens complex bump', () => {
    const config: RangeConfig = {
      rangeStrategy: 'bump',
      depType: 'dependencies',
      currentValue: '>= 1.6.0 and < 2.0.0',
    };
    expect(getRangeStrategy(config)).toBe('widen');
  });

  it('defaults to widen', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: 'dependencies',
    };
    expect(getRangeStrategy(config)).toBe('widen');
  });
});
