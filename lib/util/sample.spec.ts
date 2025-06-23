import { sampleSize } from './sample';

describe('util/sample', () => {
  describe('sampleSize', () => {
    const array = ['a', 'b', 'c', 'd'];

    it('returns correct sized array', () => {
      expect(sampleSize(array, 2)).toHaveLength(2);
      expect(sampleSize(array, 10)).toHaveLength(4);
    });

    it('returns full array for undefined number', () => {
      expect(sampleSize(array, undefined as never)).toEqual(array);
    });

    it('returns full array for null number', () => {
      expect(sampleSize(array, null as never)).toBeEmptyArray();
    });

    it('returns full array for 0 number', () => {
      expect(sampleSize(array, 0)).toBeEmptyArray();
    });

    it('returns empty array for null array', () => {
      expect(sampleSize(null as never, 1)).toBeEmptyArray();
    });

    it('returns empty array for undefined array', () => {
      expect(sampleSize(undefined as never, 1)).toBeEmptyArray();
    });

    it('returns empty array for empty array', () => {
      expect(sampleSize([], 1)).toBeEmptyArray();
    });
  });
});
