import * as starlark from './starlark';

describe('modules/manager/bazel-module/starlark', () => {
  it.each`
    a          | exp
    ${'True'}  | ${true}
    ${'False'} | ${false}
  `('.asBoolean($a)', ({ a, exp }) => {
    expect(starlark.asBoolean(a)).toBe(exp);
  });

  it('asBoolean', () => {
    expect(() => starlark.asBoolean('bad')).toThrow(
      new Error('Invalid Starlark boolean string: bad'),
    );
  });
});
