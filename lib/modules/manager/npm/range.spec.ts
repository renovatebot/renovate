import type { RangeConfig } from '../types.ts';
import type { NpmManagerData } from './types.ts';
import { getRangeStrategy } from './index.ts';

describe('modules/manager/npm/range', () => {
  it('returns same if not auto', () => {
    const config: RangeConfig = { rangeStrategy: 'widen' };
    expect(getRangeStrategy(config)).toBe('widen');
  });

  it('widens peerDependencies', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: 'peerDependencies',
    };
    expect(getRangeStrategy(config)).toBe('widen');
  });

  it('widens complex ranges', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: 'dependencies',
      currentValue: '^1.6.0 || ^2.0.0',
    };
    expect(getRangeStrategy(config)).toBe('widen');
  });

  it('widens complex bump', () => {
    const config: RangeConfig = {
      rangeStrategy: 'bump',
      depType: 'dependencies',
      currentValue: '^1.6.0 || ^2.0.0',
    };
    expect(getRangeStrategy(config)).toBe('widen');
  });

  it('bumps npm overrides', () => {
    const config: RangeConfig<NpmManagerData> = {
      rangeStrategy: 'auto',
      depType: 'overrides',
      currentValue: '^9.0.0',
      managerData: { npmLock: 'package-lock.json' },
    };
    expect(getRangeStrategy(config)).toBe('bump');
  });

  it('does not bump overrides without an npm lock file', () => {
    const config: RangeConfig<NpmManagerData> = {
      rangeStrategy: 'auto',
      depType: 'overrides',
      currentValue: '^9.0.0',
      managerData: { parents: ['foo'] },
    };
    expect(getRangeStrategy(config)).toBe('update-lockfile');
  });

  it('widens complex ranges in npm overrides', () => {
    const config: RangeConfig<NpmManagerData> = {
      rangeStrategy: 'auto',
      depType: 'overrides',
      currentValue: '^8.0.0 || ^9.0.0',
      managerData: { npmLock: 'package-lock.json' },
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
