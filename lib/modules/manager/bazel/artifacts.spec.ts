import crypto from 'node:crypto';
import { codeBlock } from 'common-tags';
import * as httpMock from '../../../../test/http-mock';
import { partial } from '../../../../test/util';
import type { UpdateArtifact } from '../types';
import { updateArtifacts } from '.';

describe('modules/manager/bazel/artifacts', () => {
  it('updates commit-based http archive', async () => {
    const inputHash =
      'f7a6ecfb8174a1dd4713ea3b21621072996ada7e8f1a69e6ae7581be137c6dd6';
    const input = codeBlock`
      http_archive(
        name="distroless",
        sha256="${inputHash}",
        strip_prefix="distroless-446923c3756ceeaa75888f52fcbdd48bb314fbf8",
        urls=["https://github.com/GoogleContainerTools/distroless/archive/446923c3756ceeaa75888f52fcbdd48bb314fbf8.tar.gz"]
      )
    `;

    const currentDigest = '446923c3756ceeaa75888f52fcbdd48bb314fbf8';
    const newDigest = '033387ac8853e6cc1cd47df6c346bc53cbc490d8';
    const upgrade = {
      depName: 'distroless',
      depType: 'http_archive',
      repo: 'GoogleContainerTools/distroless',
      managerData: { idx: 0 },
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
        '/GoogleContainerTools/distroless/archive/033387ac8853e6cc1cd47df6c346bc53cbc490d8.tar.gz',
      )
      .reply(200, tarContent);

    const res = await updateArtifacts(
      partial<UpdateArtifact>({
        packageFileName: 'WORKSPACE',
        updatedDeps: [upgrade],
        newPackageFileContent: input,
      }),
    );

    expect(res).toEqual([
      {
        file: {
          contents: output,
          path: 'WORKSPACE',
          type: 'addition',
        },
      },
    ]);
  });

  it('updates http archive with content other then WORKSPACE', async () => {
    const inputHash =
      'eb5c57e4c12e68c0c20bc774bfbc60a568e800d025557bc4ea022c6479acc867';
    const input = codeBlock`
      http_archive(
        name = "bazel_skylib",
        sha256 = "${inputHash}",
        strip_prefix = "bazel-skylib-0.6.0",
        urls = ["https://github.com/bazelbuild/bazel-skylib/archive/0.6.0.tar.gz"],
      )
    `;

    const currentValue = '0.6.0';
    const newValue = '0.8.0';
    const upgrade = {
      depName: 'bazel_skylib',
      depType: 'http_archive',
      repo: 'bazelbuild/bazel-skylib',
      managerData: { idx: 0 },
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

    const res = await updateArtifacts(
      partial<UpdateArtifact>({
        packageFileName: 'WORKSPACE',
        updatedDeps: [upgrade],
        newPackageFileContent: input,
      }),
    );

    expect(res).toEqual([
      {
        file: {
          contents: output,
          path: 'WORKSPACE',
          type: 'addition',
        },
      },
    ]);
  });

  it('updates finds url instead of urls', async () => {
    const inputHash =
      'eb5c57e4c12e68c0c20bc774bfbc60a568e800d025557bc4ea022c6479acc867';
    const input = codeBlock`
      http_archive(
        name = "bazel_skylib",
        sha256 = "${inputHash}",
        strip_prefix = "bazel-skylib-0.6.0",
        url = "https://github.com/bazelbuild/bazel-skylib/archive/0.6.0.tar.gz",
      )
    `;

    const currentValue = '0.6.0';
    const newValue = '0.8.0';
    const upgrade = {
      depName: 'bazel_skylib',
      depType: 'http_archive',
      repo: 'bazelbuild/bazel-skylib',
      managerData: { idx: 0 },
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
    expect(output.indexOf('0.8.0')).not.toBe(-1);

    httpMock
      .scope('https://github.com')
      .get('/bazelbuild/bazel-skylib/archive/0.8.0.tar.gz')
      .reply(200, tarContent);

    const res = await updateArtifacts(
      partial<UpdateArtifact>({
        packageFileName: 'WORKSPACE',
        updatedDeps: [upgrade],
        newPackageFileContent: input,
      }),
    );

    expect(res).toEqual([
      {
        file: {
          contents: output,
          path: 'WORKSPACE',
          type: 'addition',
        },
      },
    ]);
  });

  it('returns null if no urls resolve hashes', async () => {
    const inputHash =
      'eb5c57e4c12e68c0c20bc774bfbc60a568e800d025557bc4ea022c6479acc867';
    const input = codeBlock`
      http_archive(
        name = "bazel_skyfoo",
        sha256 = "${inputHash}",
        strip_prefix = "bazel-skyfoo-0.6.0",
        urls = ["https://github.com/bazelbuild/bazel-skyfoo/archive/0.6.0.tar.gz"],
      )
    `;

    const currentValue = '0.6.0';
    const newValue = '0.8.0';
    const upgrade = {
      depName: 'bazel_skylib',
      depType: 'http_archive',
      repo: 'bazelbuild/bazel-skyfoo',
      managerData: { idx: 0 },
      currentValue,
      newValue,
    };

    httpMock
      .scope('https://github.com')
      .get('/bazelbuild/bazel-skyfoo/archive/0.8.0.tar.gz')
      .reply(500);

    const res = await updateArtifacts(
      partial<UpdateArtifact>({
        packageFileName: 'WORKSPACE',
        updatedDeps: [upgrade],
        newPackageFileContent: input,
      }),
    );
    expect(res).toBeNull();
  });

  it('errors for http_archive without urls', async () => {
    const input = codeBlock`
      http_archive(
        name = "bazel_skylib",
        sha256 = "b5f6abe419da897b7901f90cbab08af958b97a8f3575b0d3dd062ac7ce78541f",
        strip_prefix = "bazel-skylib-0.5.0",
      )
    `;

    const upgrade = {
      depName: 'bazel_skylib',
      depType: 'http_archive',
      repo: 'bazelbuild/bazel-skylib',
      managerData: { idx: 0 },
      currentValue: '0.5.0',
      newValue: '0.6.2',
    };
    const res = await updateArtifacts(
      partial<UpdateArtifact>({
        packageFileName: 'WORKSPACE',
        updatedDeps: [upgrade],
        newPackageFileContent: input,
      }),
    );
    expect(res).toBeNull();
  });

  it('errors for maybe(http_archive) without urls', async () => {
    const input = codeBlock`
      maybe(
        http_archive,
        name = "bazel_skylib",
        sha256 = "b5f6abe419da897b7901f90cbab08af958b97a8f3575b0d3dd062ac7ce78541f",
        strip_prefix = "bazel-skylib-0.5.0",
      )
    `;

    const upgrade = {
      depName: 'bazel_skylib',
      depType: 'http_archive',
      repo: 'bazelbuild/bazel-skylib',
      managerData: { idx: 0 },
      currentValue: '0.5.0',
      newValue: '0.6.2',
    };
    const res = await updateArtifacts(
      partial<UpdateArtifact>({
        packageFileName: 'WORKSPACE',
        updatedDeps: [upgrade],
        newPackageFileContent: input,
      }),
    );
    expect(res).toBeNull();
  });

  it('errors for _http_archive without urls', async () => {
    const input = codeBlock`
      _http_archive(
        name = "bazel_skylib",
        sha256 = "b5f6abe419da897b7901f90cbab08af958b97a8f3575b0d3dd062ac7ce78541f",
        strip_prefix = "bazel-skylib-0.5.0",
      )
    `;

    const upgrade = {
      depName: 'bazel_skylib',
      depType: 'http_archive',
      repo: 'bazelbuild/bazel-skylib',
      managerData: { idx: 0 },
      currentValue: '0.5.0',
      newValue: '0.6.2',
    };
    const res = await updateArtifacts(
      partial<UpdateArtifact>({
        packageFileName: 'WORKSPACE',
        updatedDeps: [upgrade],
        newPackageFileContent: input,
      }),
    );
    expect(res).toBeNull();
  });

  it('errors for maybe(_http_archive) without urls', async () => {
    const input = codeBlock`
      maybe(
        _http_archive,
        name = "bazel_skylib",
        sha256 = "b5f6abe419da897b7901f90cbab08af958b97a8f3575b0d3dd062ac7ce78541f",
        strip_prefix = "bazel-skylib-0.5.0",
      )
    `;

    const upgrade = {
      depName: 'bazel_skylib',
      depType: 'http_archive',
      repo: 'bazelbuild/bazel-skylib',
      managerData: { idx: 0 },
      currentValue: '0.5.0',
      newValue: '0.6.2',
    };
    const res = await updateArtifacts(
      partial<UpdateArtifact>({
        packageFileName: 'WORKSPACE',
        updatedDeps: [upgrade],
        newPackageFileContent: input,
      }),
    );
    expect(res).toBeNull();
  });

  it('updates http_archive with urls array', async () => {
    const inputHash =
      'b5f6abe419da897b7901f90cbab08af958b97a8f3575b0d3dd062ac7ce78541f';
    const input = codeBlock`
      http_archive(
        name = "bazel_skylib",
        sha256 = "${inputHash}",
        strip_prefix = "bazel-skylib-0.5.0",
        urls = [
          "https://mirror.bazel.build/github.com/bazelbuild/bazel-skylib/archive/0.5.0.tar.gz",
          "https://github.com/bazelbuild/bazel-skylib/archive/0.5.0.tar.gz",
        ],
      )
    `;

    const currentValue = '0.5.0';
    const newValue = '0.6.2';
    const upgrade = {
      depName: 'bazel_skylib',
      depType: 'http_archive',
      repo: 'bazelbuild/bazel-skylib',
      managerData: { idx: 0 },
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

    const res = await updateArtifacts(
      partial<UpdateArtifact>({
        packageFileName: 'WORKSPACE',
        updatedDeps: [upgrade],
        newPackageFileContent: input,
      }),
    );

    expect(res).toEqual([
      {
        file: {
          contents: output,
          path: 'WORKSPACE',
          type: 'addition',
        },
      },
    ]);
  });

  it('updates maybe(http_archive) with urls array', async () => {
    const inputHash =
      'b5f6abe419da897b7901f90cbab08af958b97a8f3575b0d3dd062ac7ce78541f';
    const input = codeBlock`
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
    `;

    const currentValue = '0.5.0';
    const newValue = '0.6.2';
    const upgrade = {
      depName: 'bazel_skylib',
      depType: 'http_archive',
      repo: 'bazelbuild/bazel-skylib',
      managerData: { idx: 0 },
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

    const res = await updateArtifacts(
      partial<UpdateArtifact>({
        packageFileName: 'WORKSPACE',
        updatedDeps: [upgrade],
        newPackageFileContent: input,
      }),
    );

    expect(res).toEqual([
      {
        file: {
          contents: output,
          path: 'WORKSPACE',
          type: 'addition',
        },
      },
    ]);
  });

  it('updates _http_archive with urls array', async () => {
    const inputHash =
      'b5f6abe419da897b7901f90cbab08af958b97a8f3575b0d3dd062ac7ce78541f';
    const input = codeBlock`
      _http_archive(
        name = "bazel_skylib",
        sha256 = "${inputHash}",
        strip_prefix = "bazel-skylib-0.5.0",
        urls = [
          "https://mirror.bazel.build/github.com/bazelbuild/bazel-skylib/archive/0.5.0.tar.gz",
          "https://github.com/bazelbuild/bazel-skylib/archive/0.5.0.tar.gz",
        ],
      )
    `;

    const currentValue = '0.5.0';
    const newValue = '0.6.2';
    const upgrade = {
      depName: 'bazel_skylib',
      depType: 'http_archive',
      repo: 'bazelbuild/bazel-skylib',
      managerData: { idx: 0 },
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

    const res = await updateArtifacts(
      partial<UpdateArtifact>({
        packageFileName: 'WORKSPACE',
        updatedDeps: [upgrade],
        newPackageFileContent: input,
      }),
    );

    expect(res).toEqual([
      {
        file: {
          contents: output,
          path: 'WORKSPACE',
          type: 'addition',
        },
      },
    ]);
  });

  it('updates maybe(_http_archive) with urls array', async () => {
    const inputHash =
      'b5f6abe419da897b7901f90cbab08af958b97a8f3575b0d3dd062ac7ce78541f';
    const input = codeBlock`
      maybe(
        _http_archive,
        name = "bazel_skylib",
        sha256 = "${inputHash}",
        strip_prefix = "bazel-skylib-0.5.0",
        urls = [
            "https://mirror.bazel.build/github.com/bazelbuild/bazel-skylib/archive/0.5.0.tar.gz",
            "https://github.com/bazelbuild/bazel-skylib/archive/0.5.0.tar.gz",
        ],
      )
    `;

    const currentValue = '0.5.0';
    const newValue = '0.6.2';
    const upgrade = {
      depName: 'bazel_skylib',
      depType: 'http_archive',
      repo: 'bazelbuild/bazel-skylib',
      managerData: { idx: 0 },
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

    const res = await updateArtifacts(
      partial<UpdateArtifact>({
        packageFileName: 'WORKSPACE',
        updatedDeps: [upgrade],
        newPackageFileContent: input,
      }),
    );

    expect(res).toEqual([
      {
        file: {
          contents: output,
          path: 'WORKSPACE',
          type: 'addition',
        },
      },
    ]);
  });

  it('updates one http_archive alongside others', async () => {
    const inputHash =
      '5aef09ed3279aa01d5c928e3beb248f9ad32dde6aafe6373a8c994c3ce643064';
    const other_http_archive = codeBlock`
      http_archive(
          name = "aspect_rules_js",
          sha256 = "db9f446752fe4100320cf8487e8fd476b9af0adf6b99b601bcfd70b289bb0598",
          strip_prefix = "rules_js-1.1.2",
          url = "https://github.com/aspect-build/rules_js/archive/refs/tags/v1.1.2.tar.gz",
      )
    `;
    const upgraded_http_archive = codeBlock`
      http_archive(
          name = "rules_nodejs",
          sha256 = "${inputHash}",
          urls = ["https://github.com/bazelbuild/rules_nodejs/releases/download/5.5.3/rules_nodejs-core-5.5.3.tar.gz"],
      )
    `;

    const input = `${other_http_archive}\n${upgraded_http_archive}`;

    const currentValue = '5.5.3';
    const newValue = '5.5.4';
    const upgrade = {
      depName: 'rules_nodejs',
      depType: 'http_archive',
      repo: 'bazelbuild/rules_nodejs',
      managerData: { idx: 1 },
      currentValue,
      newValue,
    };

    const tarContent = Buffer.from('foo');
    const outputHash = crypto
      .createHash('sha256')
      .update(tarContent)
      .digest('hex');

    httpMock
      .scope('https://github.com')
      .get(
        '/bazelbuild/rules_nodejs/releases/download/5.5.4/rules_nodejs-core-5.5.4.tar.gz',
      )
      .reply(200, tarContent);

    const output = input
      .replace(currentValue, newValue)
      .replace(currentValue, newValue)
      .replace(currentValue, newValue)
      .replace(inputHash, outputHash);

    const res = await updateArtifacts(
      partial<UpdateArtifact>({
        packageFileName: 'WORKSPACE',
        updatedDeps: [upgrade],
        newPackageFileContent: input,
      }),
    );

    expect(res).toEqual([
      {
        file: {
          contents: output,
          path: 'WORKSPACE',
          type: 'addition',
        },
      },
    ]);
  });

  it('updates one http_archive alongside others with matching versions', async () => {
    const inputHash =
      '5aef09ed3279aa01d5c928e3beb248f9ad32dde6aafe6373a8c994c3ce643064';

    const other_http_archive = codeBlock`
    http_archive(
        name = "aspect_rules_js",
        sha256 = "db9f446752fe4100320cf8487e8fd476b9af0adf6b99b601bcfd70b289bb0598",
        strip_prefix = "rules_js-1.1.2",
        url = "https://github.com/aspect-build/rules_js/archive/refs/tags/v1.1.2.tar.gz",
    )`;

    const upgraded_http_archive = codeBlock`
    http_archive(
        name = "rules_nodejs",
        sha256 = "${inputHash}",
        urls = ["https://github.com/bazelbuild/rules_nodejs/releases/download/1.1.2/rules_nodejs-core-1.1.2.tar.gz"],
    )
  `;

    const input = `${other_http_archive}\n${upgraded_http_archive}`;

    const currentValue = '1.1.2';
    const newValue = '1.2.3';
    const upgrade = {
      depName: 'rules_nodejs',
      depType: 'http_archive',
      repo: 'bazelbuild/rules_nodejs',
      managerData: { idx: 1 },
      currentValue,
      newValue,
    };

    const tarContent = Buffer.from('foo');
    const outputHash = crypto
      .createHash('sha256')
      .update(tarContent)
      .digest('hex');

    httpMock
      .scope('https://github.com')
      .get(
        '/bazelbuild/rules_nodejs/releases/download/1.2.3/rules_nodejs-core-1.2.3.tar.gz',
      )
      .reply(200, tarContent);

    const output = input
      .replace(
        `${currentValue}/rules_nodejs-core-${currentValue}`,
        `${newValue}/rules_nodejs-core-${newValue}`,
      )
      .replace(inputHash, outputHash);

    const res = await updateArtifacts(
      partial<UpdateArtifact>({
        packageFileName: 'WORKSPACE',
        updatedDeps: [upgrade],
        newPackageFileContent: input,
      }),
    );

    expect(res).toEqual([
      {
        file: {
          contents: output,
          path: 'WORKSPACE',
          type: 'addition',
        },
      },
    ]);
  });
});
