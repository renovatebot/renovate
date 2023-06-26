import { clone } from './clone';

describe('util/clone', () => {
  test.each`
    input        | expected
    ${undefined} | ${undefined}
    ${null}      | ${null}
    ${true}      | ${true}
    ${false}     | ${false}
    ${0}         | ${0}
    ${1}         | ${1}
    ${NaN}       | ${NaN}
    ${Infinity}  | ${Infinity}
    ${-Infinity} | ${-Infinity}
    ${''}        | ${''}
    ${'string'}  | ${'string'}
    ${[]}        | ${[]}
    ${[1, 2, 3]} | ${[1, 2, 3]}
    ${{}}        | ${{}}
    ${{ a: 1 }}  | ${{ a: 1 }}
  `('returns $expected when input is $input', ({ input, expected }) => {
    const res = clone(input);
    expect(res).toStrictEqual(expected);
  });

  it('maintains same order', () => {
    const obj: any = {
      b: 'foo',
      a: 'bar',
      c: 'baz',
    };

    const res = clone(obj);
    expect(Object.entries(res)).toMatchObject([
      ['b', 'foo'],
      ['a', 'bar'],
      ['c', 'baz'],
    ]);
  });

  it('assigns "[Circular]" to circular references', () => {
    const obj: any = {
      name: 'object',
      type: 'object',
      isObject: true,
    };
    obj.circular = obj;

    expect(clone(obj)).toMatchObject({
      circular: '[Circular]',
      isObject: true,
      name: 'object',
      type: 'object',
    });
  });
});
