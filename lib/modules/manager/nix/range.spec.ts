import type { RangeConfig } from '../types.ts';
import { getRangeStrategy } from './index.ts';

describe('modules/manager/nix/range', () => {
  it('uses update-lockfile for pinning', () => {
    const config: RangeConfig = { rangeStrategy: 'pin' };

    expect(getRangeStrategy(config)).toBe('update-lockfile');
  });

  it('returns an explicitly configured strategy', () => {
    const config: RangeConfig = { rangeStrategy: 'replace' };

    expect(getRangeStrategy(config)).toBe('replace');
  });

  it('defaults to update-lockfile when currentValue is present', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      currentValue: 'nixos-unstable',
    };

    expect(getRangeStrategy(config)).toBe('update-lockfile');
  });

  it('defaults to update-lockfile when currentValue is absent', () => {
    const config: RangeConfig = { rangeStrategy: 'auto' };

    expect(getRangeStrategy(config)).toBe('update-lockfile');
  });

  it('defaults to update-lockfile when rangeStrategy is absent', () => {
    expect(getRangeStrategy({})).toBe('update-lockfile');
  });
});
