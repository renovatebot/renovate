import { clone } from './clone';

describe('clone', () => {
  it('copies object', () => {
    const input = {
      foo: 'foo',
      bar: 42,
      baz: null,
      qux: undefined,
    };
    const output = clone(input);
    expect(output).not.toBe(input);
    expect(output).toStrictEqual(input);
  });

  it('handles circular object', () => {
    const input = {
      x: {
        y: {
          z: null,
        },
      },
    };
    input.x.y.z = input;

    const output = clone(input);
    expect(output).not.toBe(input);
    expect(output).toStrictEqual({
      x: {
        y: {
          z: undefined,
        },
      },
    });
  });

  it('copies array', () => {
    const input = ['foo', 42, null, undefined];
    const output = clone(input);
    expect(output).not.toBe(input);
    expect(output).toStrictEqual(input);
  });

  it('rejects array with circular references', () => {
    const input: any[] = [];
    input.push(input);
    const output = clone(input);
    expect(output).toBeUndefined();
  });

  it('omits non-circular references', () => {
    const x = {
      foo: 'foo',
      bar: 'bar',
    };
    const input: any = {
      x,
      y: x,
      z: [x, x, x],
    };
    input.a = input;
    input.b = ['foo', 'bar', input];

    const output = clone(input);
    expect(output).not.toBe(input);
    expect(output).toStrictEqual({
      a: undefined,
      b: undefined,
      x: { foo: 'foo', bar: 'bar' },
      y: { foo: 'foo', bar: 'bar' },
      z: [
        { foo: 'foo', bar: 'bar' },
        { foo: 'foo', bar: 'bar' },
        { foo: 'foo', bar: 'bar' },
      ],
    });
  });
});
