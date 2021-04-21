import { readFileSync } from 'fs';
import { Readable } from 'stream';
import { resolve } from 'upath';
import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import type { UpdateType } from '../../config/types';
import { updateDependency } from './update';

const content = readFileSync(
  resolve('lib/manager/bazel/__fixtures__/WORKSPACE1'),
  'utf8'
);

const contentContainerPull = readFileSync(
  resolve('lib/manager/bazel/__fixtures__/container_pull'),
  'utf8'
);

const fileWithBzlExtension = readFileSync(
  'lib/manager/bazel/__fixtures__/repositories.bzl',
  'utf8'
);

/*
git_repository(
    name = "build_bazel_rules_nodejs",
    remote = "https://github.com/bazelbuild/rules_nodejs.git",
    tag = "0.1.8",
)
*/

describe(getName(__filename), () => {
  describe('updateDependency', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      httpMock.setup();
    });

    afterEach(() => {
      httpMock.reset();
    });

    it('updates tag', async () => {
      const upgrade = {
        depName: 'build_bazel_rules_nodejs',
        depType: 'git_repository',
        managerData: {
          def: `git_repository(\n    name = "build_bazel_rules_nodejs",\n    remote = "https://github.com/bazelbuild/rules_nodejs.git",\n    tag = "0.1.8",\n)`,
        },
        currentValue: '0.1.8',
        newValue: '0.2.0',
      };
      const res = await updateDependency({
        fileContent: content,
        upgrade,
      });
      expect(res).not.toEqual(content);
    });

    it('updates container_pull deptype and preserves comment', async () => {
      const upgrade = {
        depName: 'hasura',
        depType: 'container_pull',
        managerData: {
          def: `container_pull(
          name="hasura",
          registry="index.docker.io",
          repository="hasura/graphql-engine",
          # v1.0.0-alpha31.cli-migrations 11/28
          digest="sha256:a4e8d8c444ca04fe706649e82263c9f4c2a4229bc30d2a64561b5e1d20cc8548",
          tag="v1.0.0-alpha31.cli-migrations"
      )`,
        },
        currentValue: 'v1.0.0-alpha31.cli-migrations',
        currentDigest:
          'sha256:a4e8d8c444ca04fe706649e82263c9f4c2a4229bc30d2a64561b5e1d20cc8548',
        newDigest:
          'sha256:2c29ba015faef92a3f55b37632fc373a7fbc2c9fddd31e317bf07113391c640b',
        newValue: 'v1.0.0-alpha42.cli-migrations',
      };
      const res = await updateDependency({
        fileContent: contentContainerPull,
        upgrade,
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(contentContainerPull);
      expect(res).toContain('# v1.0.0-alpha31.cli-migrations 11/28');
    });

    it('updates commit to tag', async () => {
      const upgrade = {
        depName: 'com_github_google_uuid',
        depType: 'go_repository',
        managerData: {
          def: `go_repository(
    name = "com_github_google_uuid",
    importpath = "github.com/google/uuid",
    commit = "dec09d789f3dba190787f8b4454c7d3c936fed9e"
)
`,
        },
        currentValue: 'v0.0.0',
        currentDigest: 'dec09d789f3dba190787f8b4454c7d3c936fed9e',
        newDigest: 'aaa09d789f3dba190787f8b4454c7d3c936fe123',
        newValue: 'v1.0.3',
        updateType: 'major' as UpdateType,
      };
      const res = await updateDependency({
        fileContent: content,
        upgrade,
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(content);
      expect(res).toContain(
        '"aaa09d789f3dba190787f8b4454c7d3c936fe123",  # v1.0.3'
      );
    });
    it('updates commit-based http archive', async () => {
      const upgrade = {
        depName: 'distroless',
        depType: 'http_archive',
        repo: 'GoogleContainerTools/distroless',
        managerData: {
          def: `http_archive(\n  name="distroless",\n  sha256="f7a6ecfb8174a1dd4713ea3b21621072996ada7e8f1a69e6ae7581be137c6dd6",\n  strip_prefix="distroless-446923c3756ceeaa75888f52fcbdd48bb314fbf8",\n  urls=["https://github.com/GoogleContainerTools/distroless/archive/446923c3756ceeaa75888f52fcbdd48bb314fbf8.tar.gz"]\n)`,
        },
        currentDigest: '446923c3756ceeaa75888f52fcbdd48bb314fbf8',
        newDigest: '033387ac8853e6cc1cd47df6c346bc53cbc490d8',
      };
      httpMock
        .scope('https://github.com')
        .get(
          '/GoogleContainerTools/distroless/archive/033387ac8853e6cc1cd47df6c346bc53cbc490d8.tar.gz'
        )
        .reply(200, Readable.from(['foo']));
      const res = await updateDependency({
        fileContent: content,
        upgrade,
      });
      expect(res).not.toEqual(content);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('updates http archive with content other then WORKSPACE', async () => {
      const upgrade = {
        depName: 'bazel_skylib',
        depType: 'http_archive',
        repo: 'bazelbuild/bazel-skylib',
        managerData: {
          def: `http_archive(
            name = "bazel_skylib",
            sha256 = "eb5c57e4c12e68c0c20bc774bfbc60a568e800d025557bc4ea022c6479acc867",
            strip_prefix = "bazel-skylib-0.6.0",
            urls = ["https://github.com/bazelbuild/bazel-skylib/archive/0.6.0.tar.gz"],
          )`,
        },
        currentValue: '0.6.0',
        newValue: '0.8.0',
      };
      httpMock
        .scope('https://github.com')
        .get('/bazelbuild/bazel-skylib/archive/0.8.0.tar.gz')
        .reply(200, Readable.from(['foo']));
      const res = await updateDependency({
        fileContent: content,
        upgrade,
      });
      expect(res).not.toEqual(fileWithBzlExtension);
      expect(res.indexOf('0.8.0')).not.toBe(-1);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('updates finds url instead of urls', async () => {
      const upgrade = {
        depName: 'bazel_skylib',
        depType: 'http_archive',
        repo: 'bazelbuild/bazel-skylib',
        managerData: {
          def: `http_archive(
            name = "bazel_skylib",
            sha256 = "eb5c57e4c12e68c0c20bc774bfbc60a568e800d025557bc4ea022c6479acc867",
            strip_prefix = "bazel-skylib-0.6.0",
            url = "https://github.com/bazelbuild/bazel-skylib/archive/0.6.0.tar.gz",
          )`,
        },
        currentValue: '0.6.0',
        newValue: '0.8.0',
      };
      httpMock
        .scope('https://github.com')
        .get('/bazelbuild/bazel-skylib/archive/0.8.0.tar.gz')
        .reply(200, Readable.from(['foo']));
      const res = await updateDependency({
        fileContent: content,
        upgrade,
      });
      expect(res).not.toEqual(fileWithBzlExtension);
      expect(res.indexOf('0.8.0')).not.toBe(-1);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null if no urls resolve hashes', async () => {
      const upgrade = {
        depName: 'bazel_skylib',
        depType: 'http_archive',
        repo: 'bazelbuild/bazel-skyfoo',
        managerData: {
          def: `http_archive(
            name = "bazel_skyfoo",
            sha256 = "eb5c57e4c12e68c0c20bc774bfbc60a568e800d025557bc4ea022c6479acc867",
            strip_prefix = "bazel-skyfoo-0.6.0",
            urls = ["https://github.com/bazelbuild/bazel-skyfoo/archive/0.6.0.tar.gz"],
          )`,
        },
        currentValue: '0.6.0',
        newValue: '0.8.0',
      };
      const res = await updateDependency({
        fileContent: content,
        upgrade,
      });
      expect(res).toBeNull();
    });
    it('errors for http_archive without urls', async () => {
      const upgrade = {
        depName: 'bazel_skylib',
        depType: 'http_archive',
        repo: 'bazelbuild/bazel-skylib',
        managerData: {
          def:
            `
http_archive(
  name = "bazel_skylib",
  sha256 = "b5f6abe419da897b7901f90cbab08af958b97a8f3575b0d3dd062ac7ce78541f",
  strip_prefix = "bazel-skylib-0.5.0",
)
        `.trim() + '\n',
        },
        currentValue: '0.5.0',
        newValue: '0.6.2',
      };
      const res = await updateDependency({
        fileContent: content,
        upgrade,
      });
      expect(res).toBeNull();
    });
    it('updates http_archive with urls array', async () => {
      const upgrade = {
        depName: 'bazel_skylib',
        depType: 'http_archive',
        repo: 'bazelbuild/bazel-skylib',
        managerData: {
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
        },
        currentValue: '0.5.0',
        newValue: '0.6.2',
      };
      httpMock
        .scope('https://github.com')
        .get('/bazelbuild/bazel-skylib/archive/0.6.2.tar.gz')
        .reply(200, Readable.from(['foo']));
      httpMock
        .scope('https://mirror.bazel.build')
        .get('/github.com/bazelbuild/bazel-skylib/archive/0.6.2.tar.gz')
        .reply(200, Readable.from(['foo']));
      const res = await updateDependency({
        fileContent: content,
        upgrade,
      });
      expect(res).not.toEqual(content);
      expect(res.indexOf('0.5.0')).toBe(-1);
      expect(res.indexOf('0.6.2')).not.toBe(-1);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
