const fs = require('fs');
const path = require('path');
const got = require('got');
const bazelfile = require('../../../lib/manager/bazel/update');

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
  describe('updateDependency', () => {
    it('updates tag', async () => {
      const upgrade = {
        depName: 'build_bazel_rules_nodejs',
        depType: 'git_repository',
        def: `git_repository(\n    name = "build_bazel_rules_nodejs",\n    remote = "https://github.com/bazelbuild/rules_nodejs.git",\n    tag = "0.1.8",\n)`,
        currentValue: '0.1.8',
        newValue: '0.2.0',
      };
      const res = await bazelfile.updateDependency(content, upgrade);
      expect(res).not.toEqual(content);
    });
    it('updates commit to tag', async () => {
      const upgrade = {
        depName: 'com_github_google_uuid',
        depType: 'go_repository',
        def: `go_repository(
    name = "com_github_google_uuid",
    importpath = "github.com/google/uuid",
    commit = "dec09d789f3dba190787f8b4454c7d3c936fed9e"
)
`,
        currentValue: 'v0.0.0',
        currentDigest: 'dec09d789f3dba190787f8b4454c7d3c936fed9e',
        newValue: 'v1.0.3',
        updateType: 'major',
      };
      const res = await bazelfile.updateDependency(content, upgrade);
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(content);
      expect(res.includes('tag = "v1.0.3"')).toBe(true);
    });
    it('updates http archive', async () => {
      const upgrade = {
        depName: 'io_bazel_rules_go',
        depType: 'http_archive',
        repo: 'bazelbuild/rules_go',
        def: `http_archive(\n    name = "io_bazel_rules_go",\n    url = "https://github.com/bazelbuild/rules_go/releases/download/0.7.1/rules_go-0.7.1.tar.gz",\n    sha256 = "341d5eacef704415386974bc82a1783a8b7ffbff2ab6ba02375e1ca20d9b031c",\n)`,
        currentValue: '0.7.1',
        newValue: '0.8.1',
      };
      got.mockReturnValueOnce({ body: '' });
      const res = await bazelfile.updateDependency(content, upgrade);
      expect(res).not.toEqual(content);
      expect(res.indexOf('0.8.1')).not.toBe(-1);
    });
    it('updates second time http archive', async () => {
      const upgrade = {
        depName: 'io_bazel_rules_go',
        depType: 'http_archive',
        repo: 'bazelbuild/rules_go',
        def: `http_archive(\n    name = "io_bazel_rules_go",\n    url = "https://github.com/bazelbuild/rules_go/releases/download/0.7.1/rules_go-0.7.1.tar.gz",\n    sha256 = "341d5eacef704415386974bc82a1783a8b7ffbff2ab6ba02375e1ca20d9b031c",\n)`,
        currentValue: '0.7.1',
        newValue: '0.8.1',
      };
      got.mockReturnValueOnce(null);
      got.mockReturnValueOnce({ body: '' });
      const res = await bazelfile.updateDependency(content, upgrade);
      expect(res).not.toEqual(content);
      expect(res.indexOf('0.8.1')).not.toBe(-1);
    });
    it('updates http urls array', async () => {
      const upgrade = {
        depName: 'bazel_skylib',
        depType: 'http_archive',
        repo: 'bazelbuild/bazel-skylib',
        def:
          `
http_archive(
  name = "bazel_skylib",
  sha256 = "b5f6abe419da897b7901f90cbab08af958b97a8f3575b0d3dd062ac7ce78541f",
  strip_prefix = "bazel-skylib-0.5.0",
  urls = [
      "https://mirror.bazel.build/github.com/bazelbuild/bazel-skylib/archive/0.5.0.tar.gz",
      "https://github.com/bazelbuild/bazel-skylib/archive/0.5.0.tar.gz",
  ],
)
        `.trim() + '\n',
        currentValue: '0.5.0',
        newValue: '0.6.2',
      };
      got.mockReturnValueOnce({ body: '' });
      const res = await bazelfile.updateDependency(content, upgrade);
      expect(res).not.toEqual(content);
      expect(res.indexOf('0.5.0')).toBe(-1);
      expect(res.indexOf('0.6.2')).not.toBe(-1);
    });
    it('handles http archive error', async () => {
      const upgrade = {
        depName: 'io_bazel_rules_go',
        depType: 'http_archive',
        repo: 'bazelbuild/rules_go',
        def: `http_archive(\n    name = "io_bazel_rules_go",\n    url = "https://github.com/bazelbuild/rules_go/releases/download/0.7.1/rules_go-0.7.1.tar.gz",\n    sha256 = "341d5eacef704415386974bc82a1783a8b7ffbff2ab6ba02375e1ca20d9b031c",\n)`,
        currentValue: '0.7.1',
        newValue: '0.8.1',
      };
      got.mockImplementationOnce(() => {
        throw new Error('some error');
      });
      const res = await bazelfile.updateDependency(content, upgrade);
      expect(res).toBe(null);
    });
  });
});
