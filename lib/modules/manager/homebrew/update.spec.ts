import { Readable } from 'node:stream';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { updateDependency } from '.';

const aide = Fixtures.get('aide.rb');
const ibazel = Fixtures.get('ibazel.rb');

const baseUrl = 'https://github.com';

describe('modules/manager/homebrew/update', () => {
  it('updates "releases" github dependency', async () => {
    const upgrade = {
      currentValue: 'v0.16.1',
      depName: 'Aide',
      managerData: {
        ownerName: 'aide',
        repoName: 'aide',
        sha256:
          '0f2b7cecc70c1a27d35c06c98804fcdb9f326630de5d035afc447122186010b7',
        url: 'https://github.com/aide/aide/releases/download/v0.16.1/aide-0.16.1.tar.gz',
      },
      newValue: 'v0.17.7',
    };
    httpMock
      .scope(baseUrl)
      .get('/aide/aide/releases/download/v0.17.7/aide-0.17.7.tar.gz')
      .reply(200, Readable.from(['foo']));
    const newContent = await updateDependency({
      fileContent: aide,
      upgrade,
    });
    expect(newContent).not.toBeNull();
    expect(newContent).not.toBe(aide);
    expect(newContent).toMatchSnapshot();
  });

  it('updates "archive" github dependency', async () => {
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz',
      },
      newValue: 'v0.9.3',
    };
    httpMock
      .scope(baseUrl)
      .get(
        '/bazelbuild/bazel-watcher/releases/download/v0.9.3/bazel-watcher-0.9.3.tar.gz',
      )
      .reply(200, Readable.from(['foo']));
    const newContent = await updateDependency({
      fileContent: ibazel,
      upgrade,
    });
    expect(newContent).not.toBeNull();
    expect(newContent).not.toBe(ibazel);
    expect(newContent).toMatchSnapshot();
  });

  it('returns unchanged content if fromStream promise rejects', async () => {
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz',
      },
      newValue: 'v0.9.3',
    };
    httpMock
      .scope(baseUrl)
      .get(
        '/bazelbuild/bazel-watcher/releases/download/v0.9.3/bazel-watcher-0.9.3.tar.gz',
      )
      .replyWithError('')
      .get('/bazelbuild/bazel-watcher/archive/v0.9.3.tar.gz')
      .replyWithError('');
    const newContent = await updateDependency({
      fileContent: ibazel,
      upgrade,
    });
    expect(newContent).not.toBeNull();
    expect(newContent).toBe(ibazel);
  });

  it('returns unchanged content if url field in upgrade object is invalid', async () => {
    const content = ibazel;
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'invalid_url',
      },
      newValue: 'v0.9.3',
    };
    const newContent = await updateDependency({
      fileContent: content,
      upgrade,
    });
    expect(newContent).not.toBeNull();
    expect(newContent).toBe(content);
  });

  it('returns unchanged content if repoName in upgrade object is invalid', async () => {
    const content = ibazel;
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        ownerName: 'bazelbuild',
        repoName: 'invalid/repo/name',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz',
      },
      newValue: 'v0.9.3',
    };
    httpMock
      .scope(baseUrl)
      .get(
        '/bazelbuild/invalid/repo/name/releases/download/v0.9.3/invalid/repo/name-0.9.3.tar.gz',
      )
      .replyWithError('')
      .get('/bazelbuild/invalid/repo/name/archive/v0.9.3.tar.gz')
      .reply(200, Readable.from(['foo']));
    const newContent = await updateDependency({
      fileContent: content,
      upgrade,
    });
    expect(newContent).not.toBeNull();
    expect(newContent).toBe(content);
  });

  it('returns unchanged content if repoName in upgrade object is wrong', async () => {
    const content = ibazel;
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        ownerName: 'bazelbuild',
        repoName: 'wrong-version/archive/v10.2.3.tar.gz',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz',
      },
      newValue: 'v0.9.3',
    };
    httpMock
      .scope(baseUrl)
      .get(
        '/bazelbuild/wrong-version/archive/v10.2.3.tar.gz/releases/download/v0.9.3/wrong-version/archive/v10.2.3.tar.gz-0.9.3.tar.gz',
      )
      .replyWithError('')
      .get(
        '/bazelbuild/wrong-version/archive/v10.2.3.tar.gz/archive/v0.9.3.tar.gz',
      )
      .reply(200, Readable.from(['foo']));
    const newContent = await updateDependency({
      fileContent: content,
      upgrade,
    });
    expect(newContent).not.toBeNull();
    expect(newContent).toBe(content);
  });

  it('returns unchanged content if url field in Formula file is invalid', async () => {
    const content = `
          class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url ???https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
          sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz',
      },
      newValue: 'v0.9.3',
    };
    httpMock
      .scope(baseUrl)
      .get(
        '/bazelbuild/bazel-watcher/releases/download/v0.9.3/bazel-watcher-0.9.3.tar.gz',
      )
      .reply(200, Readable.from(['foo']));
    const newContent = await updateDependency({
      fileContent: content,
      upgrade,
    });
    expect(newContent).not.toBeNull();
    expect(newContent).toBe(content);
  });

  it('returns unchanged content if url field in Formula file is missing', async () => {
    const content = `
          class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz',
      },
      newValue: 'v0.9.3',
    };
    httpMock
      .scope(baseUrl)
      .get(
        '/bazelbuild/bazel-watcher/releases/download/v0.9.3/bazel-watcher-0.9.3.tar.gz',
      )
      .reply(200, Readable.from(['foo']));
    const newContent = await updateDependency({
      fileContent: content,
      upgrade,
    });
    expect(newContent).not.toBeNull();
    expect(newContent).toBe(content);
  });

  it('returns unchanged content if sha256 field in Formula file is invalid', async () => {
    const content = `
          class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
          sha256 ???26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
          end
      `;
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz',
      },
      newValue: 'v0.9.3',
    };
    httpMock
      .scope(baseUrl)
      .get(
        '/bazelbuild/bazel-watcher/releases/download/v0.9.3/bazel-watcher-0.9.3.tar.gz',
      )
      .reply(200, Readable.from(['foo']));
    const newContent = await updateDependency({
      fileContent: content,
      upgrade,
    });
    expect(newContent).not.toBeNull();
    expect(newContent).toBe(content);
  });

  it('returns unchanged content if sha256 field in Formula file is missing', async () => {
    const content = `
          class Ibazel < Formula
          desc 'IBazel is a tool for building Bazel targets when source files change.'
          homepage 'https://github.com/bazelbuild/bazel-watcher'
          url "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
          end
      `;
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz',
      },
      newValue: 'v0.9.3',
    };
    httpMock
      .scope(baseUrl)
      .get(
        '/bazelbuild/bazel-watcher/releases/download/v0.9.3/bazel-watcher-0.9.3.tar.gz',
      )
      .reply(200, Readable.from(['foo']));
    const newContent = await updateDependency({
      fileContent: content,
      upgrade,
    });
    expect(newContent).not.toBeNull();
    expect(newContent).toBe(content);
  });

  it('returns unchanged content if both got requests fail', async () => {
    const upgrade = {
      currentValue: 'v0.16.1',
      depName: 'Aide',
      managerData: {
        ownerName: 'aide',
        repoName: 'aide',
        sha256:
          '0f2b7cecc70c1a27d35c06c98804fcdb9f326630de5d035afc447122186010b7',
        url: 'https://github.com/aide/aide/releases/download/v0.16.1/aide-0.16.1.tar.gz',
      },
      newValue: 'v0.17.7',
    };
    httpMock
      .scope(baseUrl)
      .get('/aide/aide/releases/download/v0.17.7/aide-0.17.7.tar.gz')
      .replyWithError('')
      .get('/aide/aide/archive/v0.17.7.tar.gz')
      .replyWithError('');
    const newContent = await updateDependency({
      fileContent: aide,
      upgrade,
    });
    expect(newContent).not.toBeNull();
    expect(newContent).toBe(aide);
    expect(newContent).toMatchSnapshot();
  });
});
