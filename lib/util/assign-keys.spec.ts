import { assignKeys } from './assign-keys';

describe('util/assign-keys', () => {
  it('should assign values from right to left for specified keys', () => {
    type Left = {
      foo: number | string;
      bar: number | boolean;
      baz?: number;
    };
    const left: Left = {
      foo: 'foo',
      bar: false,
      baz: 42,
    };

    type Right = {
      foo?: number;
      bar?: number;
      baz?: number;
    };
    const right: Right = {
      foo: 1,
      bar: 2,
      baz: 3,
    };

    const result = assignKeys(left, right, ['foo', 'bar']);
    expect(result).toEqual({
      foo: 1,
      bar: 2,
      baz: 42,
    });
    expect(result).toBe(left);
  });
});
