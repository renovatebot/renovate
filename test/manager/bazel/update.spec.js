const fs = require('fs');
const hasha = require('hasha');
const path = require('path');
const bazelfile = require('../../../lib/manager/bazel/update');

jest.mock('hasha');
jest.mock('../../../lib/util/got');

const content = fs.readFileSync(
  path.resolve('test/manager/bazel/_fixtures/WORKSPACE1'),
  'utf8'
);

const contentContainerPull = fs.readFileSync(
  path.resolve('test/manager/bazel/_fixtures/container_pull'),
  'utf8'
);

const fileWithBzlExtension = fs.readFileSync(
  'test/manager/bazel/_fixtures/repositories.bzl',
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
    beforeEach(() => {
      jest.resetAllMocks();
    });
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

    it('updates container_pull deptype and prserves comment', async () => {
      const upgrade = {
        depName: 'hasura',
        depType: 'container_pull',
        def: `container_pull(
          name="hasura",
          registry="index.docker.io",
          repository="hasura/graphql-engine",
          # v1.0.0-alpha31.cli-migrations 11/28
          digest="sha256:a4e8d8c444ca04fe706649e82263c9f4c2a4229bc30d2a64561b5e1d20cc8548",
          tag="v1.0.0-alpha31.cli-migrations"
      )`,
        currentValue: 'v1.0.0-alpha31.cli-migrations',
        currentDigest:
          'sha256:a4e8d8c444ca04fe706649e82263c9f4c2a4229bc30d2a64561b5e1d20cc8548',
        newDigest:
          'sha256:2c29ba015faef92a3f55b37632fc373a7fbc2c9fddd31e317bf07113391c640b',
        newValue: 'v1.0.0-alpha42.cli-migrations',
      };
      const res = await bazelfile.updateDependency(
        contentContainerPull,
        upgrade
      );
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(contentContainerPull);
      expect(res.includes('# v1.0.0-alpha31.cli-migrations 11/28')).toBe(true);
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
        newDigest: 'aaa09d789f3dba190787f8b4454c7d3c936fe123',
        newValue: 'v1.0.3',
        updateType: 'major',
      };
      const res = await bazelfile.updateDependency(content, upgrade);
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(content);
      expect(
        res.includes('"aaa09d789f3dba190787f8b4454c7d3c936fe123",  # v1.0.3')
      ).toBe(true);
    });
    it('updates commit-based http archive', async () => {
      const upgrade = {
        depName: 'distroless',
        depType: 'http_archive',
        repo: 'GoogleContainerTools/distroless',
        def: `http_archive(\n  name="distroless",\n  sha256="f7a6ecfb8174a1dd4713ea3b21621072996ada7e8f1a69e6ae7581be137c6dd6",\n  strip_prefix="distroless-446923c3756ceeaa75888f52fcbdd48bb314fbf8",\n  urls=["https://github.com/GoogleContainerTools/distroless/archive/446923c3756ceeaa75888f52fcbdd48bb314fbf8.tar.gz"]\n)`,
        newDigest: '033387ac8853e6cc1cd47df6c346bc53cbc490d8',
      };
      hasha.fromStream.mockReturnValueOnce('abc123');
      const res = await bazelfile.updateDependency(content, upgrade);
      expect(res).not.toEqual(content);
    });
    it('updates http archive with content other then WORKSPACE', async () => {
      const upgrade = {
        depName: 'bazel_skylib',
        depType: 'http_archive',
        repo: 'bazelbuild/bazel-skylib',
        def: `http_archive(
            name = "bazel_skylib",
            sha256 = "eb5c57e4c12e68c0c20bc774bfbc60a568e800d025557bc4ea022c6479acc867",
            strip_prefix = "bazel-skylib-0.6.0",
            urls = ["https://github.com/bazelbuild/bazel-skylib/archive/0.6.0.tar.gz"],
          )`,
        currentValue: '0.6.0',
        newValue: '0.8.0',
      };
      hasha.fromStream.mockReturnValueOnce('abc123');
      const res = await bazelfile.updateDependency(
        fileWithBzlExtension,
        upgrade
      );
      expect(res).not.toEqual(fileWithBzlExtension);
      expect(res.indexOf('0.8.0')).not.toBe(-1);
    });
    it('returns null if no urls resolve hashes', async () => {
      const upgrade = {
        depName: 'bazel_skylib',
        depType: 'http_archive',
        repo: 'bazelbuild/bazel-skylib',
        def: `http_archive(
            name = "bazel_skylib",
            sha256 = "eb5c57e4c12e68c0c20bc774bfbc60a568e800d025557bc4ea022c6479acc867",
            strip_prefix = "bazel-skylib-0.6.0",
            urls = ["https://github.com/bazelbuild/bazel-skylib/archive/0.6.0.tar.gz"],
          )`,
        currentValue: '0.6.0',
        newValue: '0.8.0',
      };
      const res = await bazelfile.updateDependency(
        fileWithBzlExtension,
        upgrade
      );
      expect(res).toBeNull();
    });
    it('errors for http_archive without urls', async () => {
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
)
        `.trim() + '\n',
        currentValue: '0.5.0',
        newValue: '0.6.2',
      };
      hasha.fromStream.mockReturnValueOnce('abc123');
      const res = await bazelfile.updateDependency(content, upgrade);
      expect(res).toBeNull();
    });
    it('updates http_archive with urls array', async () => {
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
      hasha.fromStream.mockReturnValueOnce('abc123');
      const res = await bazelfile.updateDependency(content, upgrade);
      expect(res).not.toEqual(content);
      expect(res.indexOf('0.5.0')).toBe(-1);
      expect(res.indexOf('0.6.2')).not.toBe(-1);
    });
  });
});
