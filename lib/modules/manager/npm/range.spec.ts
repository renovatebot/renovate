import type { RangeConfig } from '../types';
import { getRangeStrategy } from '.';

describe('modules/manager/npm/range', () => {
  it('returns same if not auto', () => {
    const config: RangeConfig = { rangeStrategy: 'widen' };
    expect(getRangeStrategy(config)).toBe('widen');
  });

  it('replaces devDependencies', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: 'devDependencies',
    };
    expect(getRangeStrategy(config)).toBe('replace');
  });

  it('replaces app dependencies', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: 'dependencies',
    };
    expect(getRangeStrategy(config)).toBe('replace');
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

  it('defaults to replace', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: 'dependencies',
    };
    expect(getRangeStrategy(config)).toBe('replace');
  });
});
