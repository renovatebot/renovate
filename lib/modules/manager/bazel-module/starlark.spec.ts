import * as starlark from './starlark';

describe('modules/manager/bazel-module/starlark', () => {
  it('asBoolean', () => {
    expect(starlark.asBoolean('True')).toBe(true);
    expect(starlark.asBoolean('False')).toBe(false);
    expect(() => starlark.asBoolean('bad')).toThrow(
      new Error('Invalid Starlark boolean string: bad')
    );
  });
});
