import { assignKeys } from './assign-keys';

describe('util/assign-keys', () => {
  it('should assign values from right to left for specified keys', () => {
    type Left = { a: number; b: number };
    const left: Left = { a: 1, b: 2 };

    type Right = { a?: number; b?: number; c?: number };
    const right: Right = { a: 3, c: 4 };

    const result = assignKeys(left, right, ['a', 'b']);
    expect(result).toEqual({
      a: 3,
      b: 2,
    });
    expect(result).toBe(left);
  });
});
