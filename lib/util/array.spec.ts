import { isNotNullOrUndefined, toArray } from './array';

describe('util/array', () => {
  it.each`
    a                  | exp
    ${null}            | ${false}
    ${undefined}       | ${false}
    ${{ name: 'foo' }} | ${true}
  `('.isNotNullOrUndefined', ({ a, exp }) => {
    expect(isNotNullOrUndefined(a)).toEqual(exp);
  });

  it.each`
    a            | exp
    ${null}      | ${[null]}
    ${undefined} | ${[undefined]}
    ${[]}        | ${[]}
  `('.toArray', ({ a, exp }) => {
    expect(toArray(a)).toEqual(exp);
  });
});
