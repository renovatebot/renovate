import type { RangeConfig } from '../types';
import { getRangeStrategy } from '.';

describe('modules/manager/bundler/range', () => {
  describe('getRangeStrategy()', () => {
    it('returns replace when rangeStrategy is auto', () => {
      const config: RangeConfig = { rangeStrategy: 'auto' };
      expect(getRangeStrategy(config)).toBe('replace');
    });

    it('returns the config value when rangeStrategy is different than auto', () => {
      const config: RangeConfig = { rangeStrategy: 'update-lockfile' };
      expect(getRangeStrategy(config)).toBe('update-lockfile');
    });
  });
});
