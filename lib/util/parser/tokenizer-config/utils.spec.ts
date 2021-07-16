import { getName } from '../../../../test/util';
import { SortableOption } from './types';
import { ensureArray, sortOptions } from './utils';

describe(getName(), () => {
  describe('ensureArray', () => {
    it('works', () => {
      expect(ensureArray(null)).toEqual([]);
      expect(ensureArray([])).toEqual([]);
      expect(ensureArray([1, 2, 3])).toEqual([1, 2, 3]);
      expect(ensureArray(1)).toEqual([1]);
      expect(ensureArray('foo')).toEqual(['foo']);
    });
  });

  describe('sortOptions', () => {
    it('returns same array for length < 2', () => {
      expect(sortOptions([])).toEqual([]);
      expect(sortOptions([{ start: 'a' }])).toEqual([{ start: 'a' }]);
    });

    it('reorder rules to avoid tokenizer ambiguity', () => {
      const options = [
        { start: 'a' },
        { start: '[[' },
        { start: 'b' },
        { start: '[[[' },
        { start: 'c' },
        { start: '[' },
        { start: 'd' },
        { start: 'aa' },
        { start: 'bb' },
        { start: 'cc' },
        { start: 'dd' },
        { start: 'aaa' },
      ] as SortableOption[];
      expect(sortOptions(options).map(({ start }) => start)).toEqual([
        'aaa',
        'aa',
        'a',
        '[[[',
        '[[',
        '[',
        'bb',
        'b',
        'cc',
        'c',
        'dd',
        'd',
      ]);
    });
  });
});
