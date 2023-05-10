import { isNotNullOrUndefined } from './filters';

describe('modules/manager/bazel-module/filters', () => {
  it.each`
    a                  | exp
    ${null}            | ${false}
    ${undefined}       | ${false}
    ${{ name: 'foo' }} | ${true}
  `('.isNotNullOrUndefined', ({ a, exp }) => {
    expect(isNotNullOrUndefined(a)).toEqual(exp);
  });
});
