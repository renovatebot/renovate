import type { RangeConfig } from '../types';
import { getRangeStrategy } from '.';

describe('modules/manager/mix/range', () => {
  it('returns same if not auto', () => {
    const config: RangeConfig = { rangeStrategy: 'pin' };
    expect(getRangeStrategy(config)).toBe('pin');

    config.rangeStrategy = 'widen';
    expect(getRangeStrategy(config)).toBe('widen');
  });

  it('widens complex bump', () => {
    const config: RangeConfig = {
      rangeStrategy: 'bump',
      depType: 'prod',
      currentValue: '>= 1.6.0 and < 2.0.0',
    };
    expect(getRangeStrategy(config)).toBe('widen');
  });

  it('bumps non-complex bump', () => {
    const config: RangeConfig = {
      rangeStrategy: 'bump',
      depType: 'prod',
      currentValue: '~>1.0.0',
    };
    expect(getRangeStrategy(config)).toBe('bump');
  });

  it('widens complex auto', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: 'prod',
      currentValue: '<1.7.0 or ~>1.7.1',
    };
    expect(getRangeStrategy(config)).toBe('widen');
  });

  it('defaults to update-lockfile', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: 'prod',
    };
    expect(getRangeStrategy(config)).toBe('update-lockfile');
  });
});
