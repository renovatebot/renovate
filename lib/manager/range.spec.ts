import type { RangeConfig } from './types';
import { getRangeStrategy } from '.';

describe('manager/range', () => {
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
      packageJsonType: 'app',
    };
    expect(getRangeStrategy(config)).toBe('pin');
  });
  it('defaults to replace', () => {
    const config: RangeConfig = {
      manager: 'circleci',
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
