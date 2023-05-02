import type { RangeConfig } from './types';
import { getRangeStrategy } from '.';

describe('modules/manager/range', () => {
  it('returns same if not auto', () => {
    const config: RangeConfig = {
      manager: 'npm',
      rangeStrategy: 'widen',
    };
    expect(getRangeStrategy(config)).toBe('widen');
  });

  it('returns manager strategy', () => {
    const config: RangeConfig = {
      manager: 'npm',
      rangeStrategy: 'auto',
      depType: 'dependencies',
    };
    expect(getRangeStrategy(config)).toBe('update-lockfile');
  });

  it('defaults to update-lockfile if updateLockedDependency() is supported', () => {
    const config: RangeConfig = {
      manager: 'bundler',
      rangeStrategy: 'auto',
    };
    expect(getRangeStrategy(config)).toBe('update-lockfile');
  });

  it('defaults to replace', () => {
    const config: RangeConfig = {
      manager: 'sbt',
      rangeStrategy: 'auto',
    };
    expect(getRangeStrategy(config)).toBe('replace');
  });

  it('returns rangeStrategy if not auto', () => {
    const config: RangeConfig = {
      manager: 'circleci',
      rangeStrategy: 'future',
    };
    expect(getRangeStrategy(config)).toBe('future');
  });
});
