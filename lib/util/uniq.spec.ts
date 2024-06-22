import { uniq } from './uniq';

describe('util/uniq', () => {
  it('should return an array with unique elements', () => {
    const input = [1, 2, 3, 2, 1, 4];
    const expectedOutput = [1, 2, 3, 4];
    expect(uniq(input)).toEqual(expectedOutput);
  });

  it('should use the provided equality function to compare elements', () => {
    type T = { id: number };
    const input: T[] = [{ id: 1 }, { id: 2 }, { id: 1 }];
    const expectedOutput = [{ id: 1 }, { id: 2 }];
    const eql = (x: T, y: T) => x.id === y.id;
    expect(uniq(input, eql)).toEqual(expectedOutput);
  });
});
