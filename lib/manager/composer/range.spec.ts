import type { RangeConfig } from '../types';
import { getRangeStrategy } from '.';

describe('manager/composer/range', () => {
  it('returns same if not auto', () => {
    const config: RangeConfig = { rangeStrategy: 'widen' };
    expect(getRangeStrategy(config)).toBe('widen');
  });
  it('pins require-dev if already pinned', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: 'require-dev',
      currentValue: '1.0.0',
    };
    expect(getRangeStrategy(config)).toBe('pin');
  });
  it('bumps require-dev if not pinned', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: 'require-dev',
      currentValue: '^1.0.0',
    };
    expect(getRangeStrategy(config)).toBe('bump');
  });
  it('pins project require if already pinned', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      managerData: { composerJsonType: 'project' },
      depType: 'require',
      currentValue: '1.0.0',
    };
    expect(getRangeStrategy(config)).toBe('pin');
  });
  it('bumps project require if not pinned', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      managerData: { composerJsonType: 'project' },
      depType: 'require',
      currentValue: '^1.0.0',
    };
    expect(getRangeStrategy(config)).toBe('bump');
  });
  it('widens complex ranges', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: 'require',
      currentValue: '^1.6.0 || ^2.0.0',
    };
    expect(getRangeStrategy(config)).toBe('widen');
  });
  it('widens complex bump', () => {
    const config: RangeConfig = {
      rangeStrategy: 'bump',
      depType: 'require',
      currentValue: '^1.6.0 || ^2.0.0',
    };
    expect(getRangeStrategy(config)).toBe('widen');
  });
  it('defaults to replace', () => {
    const config: RangeConfig = { rangeStrategy: 'auto', depType: 'require' };
    expect(getRangeStrategy(config)).toBe('replace');
  });
});
