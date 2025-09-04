import type { RangeConfig } from '../types';
import { getRangeStrategy } from '.';

describe('modules/manager/nix/range', () => {
  it('returns replace if currentValue not null', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      currentValue: '1.0.0',
    };
    expect(getRangeStrategy(config)).toBe('replace');
  });

  it('defaults to update-lockfile', () => {
    const config: RangeConfig = { rangeStrategy: 'auto', depType: 'require' };
    expect(getRangeStrategy(config)).toBe('update-lockfile');
  });
});
