import type { RangeConfig } from '../types';
import { getRangeStrategy } from '.';

describe('modules/manager/gleam/range', () => {
  it('returns same if not auto', () => {
    const config: RangeConfig = { rangeStrategy: 'widen' };
    expect(getRangeStrategy(config)).toBe('widen');
  });

  it('widens complex ranges', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: 'dependencies',
      currentValue: '>= 1.6.0 and < 2.0.0',
    };
    expect(getRangeStrategy(config)).toBe('widen');
  });

  it('widens complex bump', () => {
    const config: RangeConfig = {
      rangeStrategy: 'bump',
      depType: 'dependencies',
      currentValue: '>= 1.6.0 and < 2.0.0',
    };
    expect(getRangeStrategy(config)).toBe('widen');
  });

  it('defaults to update-lockfile', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: 'dependencies',
    };
    expect(getRangeStrategy(config)).toBe('update-lockfile');
  });
});
