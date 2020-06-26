import { getName } from '../../test/util';
import { sampleSize } from '.';

describe(getName(__filename), () => {
  describe('sampleSize', () => {
    const array = ['a', 'b', 'c', 'd'];
    it('returns correct sized array', () => {
      expect(sampleSize(array, 2)).toHaveLength(2);
    });
    it('returns full array for undefined number', () => {
      expect(sampleSize(array, undefined)).toEqual(array);
    });
    it('returns full array for null number', () => {
      expect(sampleSize(array, null)).toEqual([]);
    });
    it('returns full array for 0 number', () => {
      expect(sampleSize(array, 0)).toEqual([]);
    });
    it('returns empty array for null array', () => {
      expect(sampleSize(null, 1)).toEqual([]);
    });
    it('returns empty array for undefined array', () => {
      expect(sampleSize(undefined, 1)).toEqual([]);
    });
    it('returns empty array for empty array', () => {
      expect(sampleSize([], 1)).toEqual([]);
    });
  });
});
