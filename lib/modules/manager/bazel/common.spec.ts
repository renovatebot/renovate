import { updateCode } from './common';

describe('modules/manager/bazel/common', () => {
  describe('updateCode', () => {
    it('returns input for invalid', () => {
      const input = `!@#`;
      const output = updateCode(input, [0], 'foobar');
      expect(output).toBe(input);
    });

    it('replaces whole rule', () => {
      const input = `git_repository(name = "foo")`;
      const output = updateCode(input, [0], 'abcde');
      expect(output).toBe(`abcde`);
    });

    it('replaces rule key', () => {
      const input = `git_repository(name = "foo")`;
      const output = updateCode(input, [0, 'name'], 'bar');
      expect(output).toBe(`git_repository(name = "bar")`);
    });

    it('returns input on wrong index', () => {
      const input = `git_repository(name = "foo")`;
      const output = updateCode(input, [1, 'name'], 'bar');
      expect(output).toBe(input);
    });

    it('returns input on wrong key', () => {
      const input = `git_repository(name = "foo")`;
      const output = updateCode(input, [0, 'foobar'], 'bar');
      expect(output).toBe(input);
    });

    it('replaces array values', () => {
      const input = `git_repository(name = "foo", deps = ["bar", "baz", "qux"])`;
      const output = updateCode(input, [0, 'deps', 1], 'BAZ');
      expect(output).toBe(
        `git_repository(name = "foo", deps = ["bar", "BAZ", "qux"])`,
      );
    });

    it('updates using function', () => {
      const input = `git_repository(name = "foo")`;
      const output = updateCode(input, [0, 'name'], (x) => x.toUpperCase());
      expect(output).toBe(`git_repository(name = "FOO")`);
    });
  });
});
