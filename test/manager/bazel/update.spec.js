const fs = require('fs');
const path = require('path');
const bazelfile = require('../../../lib/manager/bazel/update');
const got = require('got');

jest.mock('got');

const content = fs.readFileSync(
  path.resolve('test/_fixtures/bazel/WORKSPACE1'),
  'utf8'
);

/*
git_repository(
    name = "build_bazel_rules_nodejs",
    remote = "https://github.com/bazelbuild/rules_nodejs.git",
    tag = "0.1.8",
)
*/

describe('manager/bazel/update', () => {
  describe('setNewValue', () => {
    it('updates tag', async () => {
      const upgrade = {
        depName: 'build_bazel_rules_nodejs',
        depType: 'git_repository',
        def: `git_repository(\n    name = "build_bazel_rules_nodejs",\n    remote = "https://github.com/bazelbuild/rules_nodejs.git",\n    tag = "0.1.8",\n)`,
        newVersion: '0.2.0',
      };
      const res = await bazelfile.setNewValue(content, upgrade);
      expect(res).not.toEqual(content);
    });
    it('updates http archive', async () => {
      const upgrade = {
        depName: 'io_bazel_rules_go',
        depType: 'http_archive',
        repo: 'bazelbuild/rules_go',
        def: `http_archive(\n    name = "io_bazel_rules_go",\n    url = "https://github.com/bazelbuild/rules_go/releases/download/0.7.1/rules_go-0.7.1.tar.gz",\n    sha256 = "341d5eacef704415386974bc82a1783a8b7ffbff2ab6ba02375e1ca20d9b031c",\n)`,
        newVersion: '0.8.1',
      };
      got.mockReturnValueOnce({ body: '' });
      const res = await bazelfile.setNewValue(content, upgrade);
      expect(res).not.toEqual(content);
      expect(res.indexOf('0.8.1')).not.toBe(-1);
    });
    it('handles http archive error', async () => {
      const upgrade = {
        depName: 'io_bazel_rules_go',
        depType: 'http_archive',
        repo: 'bazelbuild/rules_go',
        def: `http_archive(\n    name = "io_bazel_rules_go",\n    url = "https://github.com/bazelbuild/rules_go/releases/download/0.7.1/rules_go-0.7.1.tar.gz",\n    sha256 = "341d5eacef704415386974bc82a1783a8b7ffbff2ab6ba02375e1ca20d9b031c",\n)`,
        newVersion: '0.8.1',
      };
      got.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      const res = await bazelfile.setNewValue(content, upgrade);
      expect(res).toBe(null);
    });
  });
});
