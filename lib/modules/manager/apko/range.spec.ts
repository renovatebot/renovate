import type { RangeConfig } from '../types';
import { getRangeStrategy } from './range';

describe('modules/manager/apko/range', () => {
  describe('getRangeStrategy', () => {
    it('should return the provided rangeStrategy when not auto', () => {
      expect(getRangeStrategy({ rangeStrategy: 'bump' })).toBe('bump');
      expect(getRangeStrategy({ rangeStrategy: 'widen' })).toBe('widen');
      expect(getRangeStrategy({ rangeStrategy: 'pin' })).toBe('pin');
      expect(getRangeStrategy({ rangeStrategy: 'replace' })).toBe('replace');
    });

    it('should return update-lockfile when rangeStrategy is auto', () => {
      const config: RangeConfig = { rangeStrategy: 'auto' };
      expect(getRangeStrategy(config)).toBe('update-lockfile');
    });

    it('should return update-lockfile for range constraints', () => {
      const config: RangeConfig = {
        rangeStrategy: 'auto',
        currentValue: '2.40',
      };
      expect(getRangeStrategy(config)).toBe('update-lockfile');
    });

    it('should return update-lockfile for exact versions', () => {
      const config: RangeConfig = {
        rangeStrategy: 'auto',
        currentValue: '5.2.37-r0',
      };
      expect(getRangeStrategy(config)).toBe('update-lockfile');
    });

    it('should return update-lockfile for latest versions', () => {
      const config: RangeConfig = {
        rangeStrategy: 'auto',
        currentValue: undefined,
      };
      expect(getRangeStrategy(config)).toBe('update-lockfile');
    });
  });
});
