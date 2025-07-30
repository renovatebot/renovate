import type { RangeConfig } from '../types';
import { getRangeStrategy } from '.';

describe('modules/manager/composer/range', () => {
  it('returns same if nixpkgs', () => {
    const config: RangeConfig = { rangeStrategy: 'widen', depName: 'nixpkgs' };
    expect(getRangeStrategy(config)).toBe('widen');
  });

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
