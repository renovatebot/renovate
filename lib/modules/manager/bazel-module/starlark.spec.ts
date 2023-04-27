import { StarlarkBoolean } from './starlark';

describe('modules/manager/bazel-module/starlark', () => {
  describe('StarlarkBoolean', () => {
    it('asBoolean', () => {
      expect(StarlarkBoolean.asBoolean('True')).toBe(true);
      expect(StarlarkBoolean.asBoolean('False')).toBe(false);
      expect(() => StarlarkBoolean.asBoolean('bad')).toThrow(
        new Error('Invalid Starlark boolean string: bad')
      );
    });
  });
});
