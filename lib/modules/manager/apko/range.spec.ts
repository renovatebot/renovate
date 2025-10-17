import { getRangeStrategy } from './range';

describe('modules/manager/apko/range', () => {
  describe('getRangeStrategy', () => {
    it('should return the provided rangeStrategy when not auto', () => {
      expect(getRangeStrategy({ rangeStrategy: 'bump' })).toBe('bump');
      expect(getRangeStrategy({ rangeStrategy: 'widen' })).toBe('widen');
      expect(getRangeStrategy({ rangeStrategy: 'pin' })).toBe('pin');
    });

    it('should return replace when rangeStrategy is auto', () => {
      expect(getRangeStrategy({ rangeStrategy: 'auto' })).toBe('replace');
    });
  });
});
