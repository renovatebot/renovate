import { getDefault } from './defaults';
import type { RenovateOptions } from './types';

describe('config/defaults', () => {
  describe('getDefault()', () => {
    it('returns new instances of arrays when called repeatedly', () => {
      const option: RenovateOptions = {
        type: 'array',
        description: 'thing',
        name: 'thing',
      };
      const array1 = getDefault(option);
      const array2 = getDefault(option);

      // Equal values, different objects
      expect(array2).toEqual(array2);
      expect(array1).not.toBe(array2);
    });

    it('returns true for boolean values', () => {
      const option: RenovateOptions = {
        type: 'boolean',
        description: 'thing',
        name: 'thing',
      };
      const val = getDefault(option);

      expect(val).toBe(true);
    });

    it.each(['string', 'object', 'integer'])(
      'returns null for %s values',
      (type: string) => {
        const option: RenovateOptions = {
          type: type as 'string' | 'object' | 'integer',
          description: 'thing',
          name: 'thing',
        };
        const val = getDefault(option);

        expect(val).toBeNull();
      },
    );
  });
});
