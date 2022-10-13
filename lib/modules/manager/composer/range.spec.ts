import type { RangeConfig } from '../types';
import { getRangeStrategy } from '.';

describe('modules/manager/composer/range', () => {
  it('returns same if not auto', () => {
    const config: RangeConfig = { rangeStrategy: 'widen' };
    expect(getRangeStrategy(config)).toBe('widen');
  });

  it('replaces require-dev', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: 'require-dev',
    };
    expect(getRangeStrategy(config)).toBe('replace');
  });

  it('replaces project require', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      managerData: { composerJsonType: 'project' },
      depType: 'require',
    };
    expect(getRangeStrategy(config)).toBe('replace');
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

  it('defaults to widen for TYPO3 extensions', () => {
    const config: RangeConfig = {
      managerData: {
        composerJsonType: 'typo3-cms-extension',
      },
      rangeStrategy: 'auto',
      depType: 'require',
    };
    expect(getRangeStrategy(config)).toBe('widen');
  });
});
