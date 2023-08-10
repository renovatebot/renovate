import { isNotNullOrUndefined } from './array';

describe('util/array', () => {
  it.each`
    a                  | exp
    ${null}            | ${false}
    ${undefined}       | ${false}
    ${{ name: 'foo' }} | ${true}
  `('.isNotNullOrUndefined', ({ a, exp }) => {
    expect(isNotNullOrUndefined(a)).toEqual(exp);
  });
});
