import { filterMap } from './filter-map';

describe('util/filter-map', () => {
  it('should return an empty array when given an empty array', () => {
    const input: unknown[] = [];
    const output = filterMap(input, () => 42);
    expect(output).toBe(input);
    expect(output).toBeEmpty();
  });

  it('should return an array with only the mapped values that pass the filter', () => {
    const input = [0, 1, 2, 3, 4];
    const output = filterMap(input, (n) => n * n);
    expect(output).toBe(input);
    expect(output).toEqual([1, 4, 9, 16]);
  });
});
