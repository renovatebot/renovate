import type { RangeConfig } from '../types';
import { getRangeStrategy } from '.';

describe('modules/manager/swift/range', () => {
  describe('getRangeStrategy()', () => {
    it('returns same if not auto', () => {
      const config: RangeConfig = { rangeStrategy: 'widen' };
      expect(getRangeStrategy(config)).toBe('widen');
    });

    it('defaults to update-lockfile', () => {
      const config: RangeConfig = { rangeStrategy: 'auto' };
      expect(getRangeStrategy(config)).toBe('bump');
    });
  });
});
