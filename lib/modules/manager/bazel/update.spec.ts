import crypto from 'crypto';
import * as httpMock from '../../../../test/http-mock';
import type { UpdateType } from '../../../config/types';
import { updateDependency } from '.';

describe('modules/manager/bazel/update', () => {
  describe('updateDependency', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('updates git_repository tag', async () => {
      const input = `
        git_repository(
          name = "build_bazel_rules_nodejs",
          remote = "https://github.com/bazelbuild/rules_nodejs.git",
          tag = "0.1.8",
        )
      `.trim();

      const upgrade = {
        depName: 'build_bazel_rules_nodejs',
        depType: 'git_repository',
        managerData: { def: input },
        currentValue: '0.1.8',
        newValue: '0.2.0',
      };
      const output = input.replace('0.1.8', '0.2.0');

      const res = await updateDependency({
        fileContent: input,
        upgrade,
      });

      expect(res).toEqual(output);
    });

    it('updates maybe(git_repository) tag', async () => {
      const input =
        `
        maybe(
          git_repository,
          name = "build_bazel_rules_nodejs",
          remote = "https://github.com/bazelbuild/rules_nodejs.git",
          tag = "0.1.8",
        )
      `.trim() + '\n';

      const upgrade = {
        depName: 'build_bazel_rules_nodejs',
        depType: 'git_repository',
        managerData: { def: input },
        currentValue: '0.1.8',
        newValue: '0.2.0',
      };
      const output = input.replace('0.1.8', '0.2.0');

      const res = await updateDependency({
        fileContent: input,
        upgrade,
      });

      expect(res).toEqual(output);
    });

    it('updates container_pull deptype and preserves comment', async () => {
      const input = `
        container_pull(
          name="hasura",
          registry="index.docker.io",
          repository="hasura/graphql-engine",
          # v1.0.0-alpha31.cli-migrations 11/28
          digest="sha256:a4e8d8c444ca04fe706649e82263c9f4c2a4229bc30d2a64561b5e1d20cc8548",
          tag="v1.0.0-alpha31.cli-migrations"
        )
      `.trim();

      const currentValue = 'v1.0.0-alpha31.cli-migrations';
      const newValue = 'v1.0.0-alpha42.cli-migrations';

      const currentDigest =
        'sha256:a4e8d8c444ca04fe706649e82263c9f4c2a4229bc30d2a64561b5e1d20cc8548';
      const newDigest =
        'sha256:2c29ba015faef92a3f55b37632fc373a7fbc2c9fddd31e317bf07113391c640b';

      const upgrade = {
        depName: 'hasura',
        depType: 'container_pull',
        managerData: { def: input },
        currentValue,
        newValue,
        currentDigest,
        newDigest,
      };

      const output = input
        .replace(`tag="${currentValue}"`, `tag="${newValue}"`)
        .replace(currentDigest, newDigest);

      const res = await updateDependency({ fileContent: input, upgrade });

      expect(res).toEqual(output);
      expect(res).toContain('# v1.0.0-alpha31.cli-migrations 11/28');
    });

    it('updates commit to tag', async () => {
      const input = `
        go_repository(
          name = "com_github_google_uuid",
          importpath = "github.com/google/uuid",
          commit = "dec09d789f3dba190787f8b4454c7d3c936fed9e"
        )
      `.trim();

      const currentDigest = 'dec09d789f3dba190787f8b4454c7d3c936fed9e';
      const newDigest = 'aaa09d789f3dba190787f8b4454c7d3c936fe123';
      const newValue = 'v1.0.3';

      const upgrade = {
        depName: 'com_github_google_uuid',
        depType: 'go_repository',
        managerData: { def: input },
        currentValue: 'v0.0.0',
        currentDigest,
        newDigest,
        newValue,
        updateType: 'major' as UpdateType,
      };

      const output = input.replace(
        `"${currentDigest}"`,
        `"${newDigest}",  # ${newValue}`
      );

      const res = await updateDependency({ fileContent: input, upgrade });

      expect(res).toEqual(output);
      expect(res).toContain(
        '"aaa09d789f3dba190787f8b4454c7d3c936fe123",  # v1.0.3'
      );
    });

    it('updates commit-based http archive', async () => {
      const inputHash =
        'f7a6ecfb8174a1dd4713ea3b21621072996ada7e8f1a69e6ae7581be137c6dd6';
      const input = `
        http_archive(
          name="distroless",
          sha256="${inputHash}",
          strip_prefix="distroless-446923c3756ceeaa75888f52fcbdd48bb314fbf8",
          urls=["https://github.com/GoogleContainerTools/distroless/archive/446923c3756ceeaa75888f52fcbdd48bb314fbf8.tar.gz"]
        )
      `.trim();

      const currentDigest = '446923c3756ceeaa75888f52fcbdd48bb314fbf8';
      const newDigest = '033387ac8853e6cc1cd47df6c346bc53cbc490d8';
      const upgrade = {
        depName: 'distroless',
        depType: 'http_archive',
        repo: 'GoogleContainerTools/distroless',
        managerData: { def: input },
        currentDigest,
        newDigest,
      };

      const tarContent = Buffer.from('foo');
      const outputHash = crypto
        .createHash('sha256')
        .update(tarContent)
        .digest('hex');

      const output = input
        .replace(currentDigest, newDigest)
        .replace(currentDigest, newDigest)
        .replace(inputHash, outputHash);

      httpMock
        .scope('https://github.com')
        .get(
          '/GoogleContainerTools/distroless/archive/033387ac8853e6cc1cd47df6c346bc53cbc490d8.tar.gz'
        )
        .reply(200, tarContent);

      const res = await updateDependency({ fileContent: input, upgrade });

      expect(res).toEqual(output);
    });

    it('updates http archive with content other then WORKSPACE', async () => {
      const inputHash =
        'eb5c57e4c12e68c0c20bc774bfbc60a568e800d025557bc4ea022c6479acc867';
      const input = `
        http_archive(
          name = "bazel_skylib",
          sha256 = "${inputHash}",
          strip_prefix = "bazel-skylib-0.6.0",
          urls = ["https://github.com/bazelbuild/bazel-skylib/archive/0.6.0.tar.gz"],
        )
      `.trim();

      const currentValue = '0.6.0';
      const newValue = '0.8.0';
      const upgrade = {
        depName: 'bazel_skylib',
        depType: 'http_archive',
        repo: 'bazelbuild/bazel-skylib',
        managerData: { def: input },
        currentValue,
        newValue,
      };

      const tarContent = Buffer.from('foo');
      const outputHash = crypto
        .createHash('sha256')
        .update(tarContent)
        .digest('hex');

      const output = input
        .replace(currentValue, newValue)
        .replace(currentValue, newValue)
        .replace(inputHash, outputHash);

      httpMock
        .scope('https://github.com')
        .get('/bazelbuild/bazel-skylib/archive/0.8.0.tar.gz')
        .reply(200, tarContent);

      const res = await updateDependency({ fileContent: input, upgrade });

      expect(res).toEqual(output);
    });

    it('updates finds url instead of urls', async () => {
      const inputHash =
        'eb5c57e4c12e68c0c20bc774bfbc60a568e800d025557bc4ea022c6479acc867';
      const input = `
        http_archive(
          name = "bazel_skylib",
          sha256 = "${inputHash}",
          strip_prefix = "bazel-skylib-0.6.0",
          url = "https://github.com/bazelbuild/bazel-skylib/archive/0.6.0.tar.gz",
        )
      `.trim();

      const currentValue = '0.6.0';
      const newValue = '0.8.0';
      const upgrade = {
        depName: 'bazel_skylib',
        depType: 'http_archive',
        repo: 'bazelbuild/bazel-skylib',
        managerData: { def: input },
        currentValue,
        newValue,
      };

      const tarContent = Buffer.from('foo');
      const outputHash = crypto
        .createHash('sha256')
        .update(tarContent)
        .digest('hex');

      const output = input
        .replace(currentValue, newValue)
        .replace(currentValue, newValue)
        .replace(inputHash, outputHash);

      httpMock
        .scope('https://github.com')
        .get('/bazelbuild/bazel-skylib/archive/0.8.0.tar.gz')
        .reply(200, tarContent);

      const res = await updateDependency({ fileContent: input, upgrade });

      expect(res).toEqual(output);
      expect(res?.indexOf('0.8.0')).not.toBe(-1);
    });

    it('returns null if no urls resolve hashes', async () => {
      const inputHash =
        'eb5c57e4c12e68c0c20bc774bfbc60a568e800d025557bc4ea022c6479acc867';
      const input = `
        http_archive(
          name = "bazel_skyfoo",
          sha256 = "${inputHash}",
          strip_prefix = "bazel-skyfoo-0.6.0",
          urls = ["https://github.com/bazelbuild/bazel-skyfoo/archive/0.6.0.tar.gz"],
        )
      `.trim();

      const currentValue = '0.6.0';
      const newValue = '0.8.0';
      const upgrade = {
        depName: 'bazel_skylib',
        depType: 'http_archive',
        repo: 'bazelbuild/bazel-skyfoo',
        managerData: { def: input },
        currentValue,
        newValue,
      };

      httpMock
        .scope('https://github.com')
        .get('/bazelbuild/bazel-skyfoo/archive/0.8.0.tar.gz')
        .reply(500);

      const res = await updateDependency({ fileContent: input, upgrade });

      expect(res).toBeNull();
    });

    it('errors for http_archive without urls', async () => {
      const input = `
        http_archive(
          name = "bazel_skylib",
          sha256 = "b5f6abe419da897b7901f90cbab08af958b97a8f3575b0d3dd062ac7ce78541f",
          strip_prefix = "bazel-skylib-0.5.0",
        )
      `.trim();

      const upgrade = {
        depName: 'bazel_skylib',
        depType: 'http_archive',
        repo: 'bazelbuild/bazel-skylib',
        managerData: { def: input },
        currentValue: '0.5.0',
        newValue: '0.6.2',
      };
      const res = await updateDependency({ fileContent: input, upgrade });
      expect(res).toBeNull();
    });

    it('errors for maybe(http_archive) without urls', async () => {
      const input = `
        maybe(
          http_archive,
          name = "bazel_skylib",
          sha256 = "b5f6abe419da897b7901f90cbab08af958b97a8f3575b0d3dd062ac7ce78541f",
          strip_prefix = "bazel-skylib-0.5.0",
        )
      `.trim();

      const upgrade = {
        depName: 'bazel_skylib',
        depType: 'http_archive',
        repo: 'bazelbuild/bazel-skylib',
        managerData: { def: input },
        currentValue: '0.5.0',
        newValue: '0.6.2',
      };
      const res = await updateDependency({ fileContent: input, upgrade });
      expect(res).toBeNull();
    });

    it('updates http_archive with urls array', async () => {
      const inputHash =
        'b5f6abe419da897b7901f90cbab08af958b97a8f3575b0d3dd062ac7ce78541f';
      const input = `
        http_archive(
          name = "bazel_skylib",
          sha256 = "${inputHash}",
          strip_prefix = "bazel-skylib-0.5.0",
          urls = [
            "https://mirror.bazel.build/github.com/bazelbuild/bazel-skylib/archive/0.5.0.tar.gz",
            "https://github.com/bazelbuild/bazel-skylib/archive/0.5.0.tar.gz",
          ],
        )
      `.trim();

      const currentValue = '0.5.0';
      const newValue = '0.6.2';
      const upgrade = {
        depName: 'bazel_skylib',
        depType: 'http_archive',
        repo: 'bazelbuild/bazel-skylib',
        managerData: { def: input },
        currentValue,
        newValue,
      };

      const tarContent = Buffer.from('foo');
      const outputHash = crypto
        .createHash('sha256')
        .update(tarContent)
        .digest('hex');

      const output = input
        .replace(currentValue, newValue)
        .replace(currentValue, newValue)
        .replace(currentValue, newValue)
        .replace(inputHash, outputHash);

      httpMock
        .scope('https://github.com')
        .get('/bazelbuild/bazel-skylib/archive/0.6.2.tar.gz')
        .reply(200, tarContent);

      httpMock
        .scope('https://mirror.bazel.build')
        .get('/github.com/bazelbuild/bazel-skylib/archive/0.6.2.tar.gz')
        .reply(200, tarContent);

      const res = await updateDependency({ fileContent: input, upgrade });

      expect(res).toEqual(output);
    });

    it('updates maybe(http_archive) with urls array', async () => {
      const inputHash =
        'b5f6abe419da897b7901f90cbab08af958b97a8f3575b0d3dd062ac7ce78541f';
      const input = `
        maybe(
          http_archive,
          name = "bazel_skylib",
          sha256 = "${inputHash}",
          strip_prefix = "bazel-skylib-0.5.0",
          urls = [
              "https://mirror.bazel.build/github.com/bazelbuild/bazel-skylib/archive/0.5.0.tar.gz",
              "https://github.com/bazelbuild/bazel-skylib/archive/0.5.0.tar.gz",
          ],
        )
      `.trim();

      const currentValue = '0.5.0';
      const newValue = '0.6.2';
      const upgrade = {
        depName: 'bazel_skylib',
        depType: 'http_archive',
        repo: 'bazelbuild/bazel-skylib',
        managerData: { def: input },
        currentValue,
        newValue,
      };

      const tarContent = Buffer.from('foo');
      const outputHash = crypto
        .createHash('sha256')
        .update(tarContent)
        .digest('hex');

      const output = input
        .replace(currentValue, newValue)
        .replace(currentValue, newValue)
        .replace(currentValue, newValue)
        .replace(inputHash, outputHash);

      httpMock
        .scope('https://github.com')
        .get('/bazelbuild/bazel-skylib/archive/0.6.2.tar.gz')
        .reply(200, tarContent);
      httpMock
        .scope('https://mirror.bazel.build')
        .get('/github.com/bazelbuild/bazel-skylib/archive/0.6.2.tar.gz')
        .reply(200, tarContent);

      const res = await updateDependency({ fileContent: input, upgrade });
      expect(res).toEqual(output);
    });
  });

  it('updates one http_archive alongside others', async () => {
    const inputHash1 =
      '5aef09ed3279aa01d5c928e3beb248f9ad32dde6aafe6373a8c994c3ce643064';
    const other_http_archive = `
      http_archive(
          name = "aspect_rules_js",
          sha256 = "db9f446752fe4100320cf8487e8fd476b9af0adf6b99b601bcfd70b289bb0598",
          strip_prefix = "rules_js-1.1.2",
          url = "https://github.com/aspect-build/rules_js/archive/refs/tags/v1.1.2.tar.gz",
      )
    `.trim();
    const upgraded_http_archive = `
      http_archive(
          name = "rules_nodejs",
          sha256 = "${inputHash1}",
          urls = ["https://github.com/bazelbuild/rules_nodejs/releases/download/5.5.3/rules_nodejs-core-5.5.3.tar.gz"],
      )
    `.trim();

    const input = `${other_http_archive}\n${upgraded_http_archive}`;

    const currentValue1 = '5.5.3';
    const newValue1 = '5.5.4';
    const upgrade1 = {
      depName: 'rules_nodejs',
      depType: 'http_archive',
      repo: 'bazelbuild/rules_nodejs',
      managerData: { def: upgraded_http_archive },
      currentValue: currentValue1,
      newValue: newValue1,
    };

    const tarContent1 = Buffer.from('foo');
    const outputHash1 = crypto
      .createHash('sha256')
      .update(tarContent1)
      .digest('hex');

    httpMock
      .scope('https://github.com')
      .get(
        '/bazelbuild/rules_nodejs/releases/download/5.5.4/rules_nodejs-core-5.5.4.tar.gz'
      )
      .reply(200, tarContent1);

    const output1 = input
      .replace(currentValue1, newValue1)
      .replace(currentValue1, newValue1)
      .replace(currentValue1, newValue1)
      .replace(inputHash1, outputHash1);

    const res = await updateDependency({
      fileContent: input,
      upgrade: upgrade1,
    });
    expect(res).toEqual(output1);
  });

  it('updates one http_archive alongside others with matching versions', async () => {
    const inputHash1 =
      '5aef09ed3279aa01d5c928e3beb248f9ad32dde6aafe6373a8c994c3ce643064';

    const other_http_archive = `
      http_archive(
          name = "aspect_rules_js",
          sha256 = "db9f446752fe4100320cf8487e8fd476b9af0adf6b99b601bcfd70b289bb0598",
          strip_prefix = "rules_js-1.1.2",
          url = "https://github.com/aspect-build/rules_js/archive/refs/tags/v1.1.2.tar.gz",
      )`.trim();

    const upgraded_http_archive = `
      http_archive(
          name = "rules_nodejs",
          sha256 = "${inputHash1}",
          urls = ["https://github.com/bazelbuild/rules_nodejs/releases/download/1.1.2/rules_nodejs-core-1.1.2.tar.gz"],
      )
    `.trim();

    const input = `${other_http_archive}\n${upgraded_http_archive}`;

    const currentValue1 = '1.1.2';
    const newValue1 = '1.2.3';
    const upgrade1 = {
      depName: 'rules_nodejs',
      depType: 'http_archive',
      repo: 'bazelbuild/rules_nodejs',
      managerData: { def: upgraded_http_archive },
      currentValue: currentValue1,
      newValue: newValue1,
    };

    const tarContent1 = Buffer.from('foo');
    const outputHash1 = crypto
      .createHash('sha256')
      .update(tarContent1)
      .digest('hex');

    httpMock
      .scope('https://github.com')
      .get(
        '/bazelbuild/rules_nodejs/releases/download/1.2.3/rules_nodejs-core-1.2.3.tar.gz'
      )
      .reply(200, tarContent1);

    const output1 = input
      .replace(
        `${currentValue1}/rules_nodejs-core-${currentValue1}`,
        `${newValue1}/rules_nodejs-core-${newValue1}`
      )
      .replace(inputHash1, outputHash1);

    const res = await updateDependency({
      fileContent: input,
      upgrade: upgrade1,
    });
    expect(res).toEqual(output1);
  });
});
