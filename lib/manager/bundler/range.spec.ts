import type { RangeConfig } from '../types';
import { getRangeStrategy } from '.';

describe('manager/bundler/range', () => {
  describe('getRangeStrategy()', () => {
    it('returns replace when rangeStrategy is auto', () => {
      const config: RangeConfig = { rangeStrategy: 'auto' };
      expect(getRangeStrategy(config)).toBe('replace');
    });
    it('returns the config value when rangeStrategy is different than auto', () => {
      const config: RangeConfig = { rangeStrategy: 'update-lockfile' };
      expect(getRangeStrategy(config)).toBe('update-lockfile');
    });
    it('returns update-lockfile when currentValue is default range and rangeStrategy is auto', () => {
      const config: RangeConfig = {
        rangeStrategy: 'auto',
        currentValue: '>= 0',
      };
      expect(getRangeStrategy(config)).toBe('update-lockfile');
    });
    it('returns replace when currentValue is not default range', () => {
      const config: RangeConfig = {
        rangeStrategy: 'auto',
        currentValue: '>= 0.0.1',
      };
      expect(getRangeStrategy(config)).toBe('replace');
    });
  });
});
