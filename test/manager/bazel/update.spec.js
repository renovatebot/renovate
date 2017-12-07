const fs = require('fs');
const path = require('path');
const bazelfile = require('../../../lib/manager/bazel/update');

const content = fs.readFileSync(
  path.resolve('test/_fixtures/bazel/WORKSPACE1'),
  'utf8'
);

describe('manager/bazel/update', () => {
  describe('setNewValue', () => {
    it('updates tag', () => {
      const upgrade = {
        def: `git_repository(\n    name = "build_bazel_rules_nodejs",\n    remote = "https://github.com/bazelbuild/rules_nodejs.git",\n    tag = "0.1.8",\n)`,
        newVersion: '0.2.0',
      };
      const res = bazelfile.setNewValue(content, upgrade);
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(content);
    });
    it('returns null on error', () => {
      const res = bazelfile.setNewValue(content, {});
      expect(res).toBe(null);
    });
  });
});
