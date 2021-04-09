import type { RangeConfig } from './types';
import { getRangeStrategy } from '.';

describe('getRangeStrategy', () => {
  it('returns same if not auto', () => {
    const config: RangeConfig = {
      manager: 'npm',
      rangeStrategy: 'widen',
    };
    expect(getRangeStrategy(config)).toEqual('widen');
  });
  it('returns manager strategy', () => {
    const config: RangeConfig = {
      manager: 'npm',
      rangeStrategy: 'auto',
      depType: 'dependencies',
      packageJsonType: 'app',
    };
    expect(getRangeStrategy(config)).toEqual('pin');
  });
  it('defaults to replace', () => {
    const config: RangeConfig = {
      manager: 'circleci',
      rangeStrategy: 'auto',
    };
    expect(getRangeStrategy(config)).toEqual('replace');
  });
  it('returns rangeStrategy if not auto', () => {
    const config: RangeConfig = {
      manager: 'circleci',
      rangeStrategy: 'future',
    };
    expect(getRangeStrategy(config)).toEqual('future');
  });
});
