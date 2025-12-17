import { Readable } from 'node:stream';
import { codeBlock } from 'common-tags';
import * as handlers from './handlers';
import { updateDependency } from '.';
import { Fixtures } from '~test/fixtures';
import * as httpMock from '~test/http-mock';

const aide = Fixtures.get('aide.rb.sample');
const ibazel = Fixtures.get('ibazel.rb.sample');

const baseUrl = 'https://github.com';

describe('modules/manager/homebrew/update', () => {
  it('updates "releases" github dependency', async () => {
    const upgrade = {
      currentValue: 'v0.16.1',
      depName: 'Aide',
      managerData: {
        type: 'github' as const,
        ownerName: 'aide',
        repoName: 'aide',
        sha256:
          '0f2b7cecc70c1a27d35c06c98804fcdb9f326630de5d035afc447122186010b7',
        url: 'https://github.com/aide/aide/releases/download/v0.16.1/aide-0.16.1.tar.gz',
        urlType: 'releases' as const,
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

    expect(newContent).not.toBe(aide);
    expect(newContent).toContain(
      'https://github.com/aide/aide/releases/download/v0.17.7/aide-0.17.7.tar.gz',
    );
    expect(newContent).toContain(
      '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
    );
  });

  it('updates "archive" github dependency', async () => {
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        type: 'github' as const,
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz',
        urlType: 'archive' as const,
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

    expect(newContent).not.toBe(ibazel);
    expect(newContent).toContain(
      'https://github.com/bazelbuild/bazel-watcher/releases/download/v0.9.3/bazel-watcher-0.9.3.tar.gz',
    );
    expect(newContent).toContain(
      '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
    );
  });

  it('updates "archive" github dependency from old url format', async () => {
    const oldArchiveFormat = codeBlock`
      class Ibazel < Formula
      desc 'IBazel is a tool for building Bazel targets when source files change.'
      homepage 'https://github.com/bazelbuild/bazel-watcher'
      url "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
      sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
      end
    `;

    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        type: 'github' as const,
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz',
        urlType: 'archive' as const,
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
      fileContent: oldArchiveFormat,
      upgrade,
    });

    expect(newContent).not.toBe(oldArchiveFormat);
    expect(newContent).toContain(
      'https://github.com/bazelbuild/bazel-watcher/releases/download/v0.9.3/bazel-watcher-0.9.3.tar.gz',
    );
    expect(newContent).toContain(
      '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
    );
  });

  it('returns unchanged content if fromStream promise rejects', async () => {
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        type: 'github' as const,
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz',
        urlType: 'archive' as const,
      },
      newValue: 'v0.9.3',
    };
    httpMock
      .scope(baseUrl)
      .get(
        '/bazelbuild/bazel-watcher/releases/download/v0.9.3/bazel-watcher-0.9.3.tar.gz',
      )
      .replyWithError('')
      .get('/bazelbuild/bazel-watcher/archive/refs/tags/v0.9.3.tar.gz')
      .replyWithError('');

    const newContent = await updateDependency({
      fileContent: ibazel,
      upgrade,
    });

    expect(newContent).toBe(ibazel);
  });

  it('returns unchanged content if url field in upgrade object is invalid', async () => {
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        type: 'github' as const,
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'invalid_url',
        urlType: 'archive' as const,
      },
      newValue: 'v0.9.3',
    };

    const newContent = await updateDependency({
      fileContent: ibazel,
      upgrade,
    });

    expect(newContent).toBe(ibazel);
  });

  it('returns unchanged content if repoName in upgrade object is invalid', async () => {
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        type: 'github' as const,
        ownerName: 'bazelbuild',
        repoName: 'invalid/repo/name',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz',
        urlType: 'archive' as const,
      },
      newValue: 'v0.9.3',
    };

    const newContent = await updateDependency({
      fileContent: ibazel,
      upgrade,
    });

    expect(newContent).toBe(ibazel);
  });

  it('returns unchanged content if repoName in upgrade object is wrong', async () => {
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        type: 'github' as const,
        ownerName: 'bazelbuild',
        repoName: 'wrong-version/archive/refs/tags/v10.2.3.tar.gz',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz',
        urlType: 'archive' as const,
      },
      newValue: 'v0.9.3',
    };

    const newContent = await updateDependency({
      fileContent: ibazel,
      upgrade,
    });

    expect(newContent).toBe(ibazel);
  });

  it('returns unchanged content if url field in Formula file is invalid', async () => {
    const invalidUrlFormula = codeBlock`
      class Ibazel < Formula
      desc 'IBazel is a tool for building Bazel targets when source files change.'
      homepage 'https://github.com/bazelbuild/bazel-watcher'
      url ???https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz"
      sha256 '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
      end
    `;

    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        type: 'github' as const,
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz',
        urlType: 'archive' as const,
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
      fileContent: invalidUrlFormula,
      upgrade,
    });

    expect(newContent).toBe(invalidUrlFormula);
  });

  it('returns unchanged content if url field in Formula file is missing', async () => {
    const missingUrlFormula = codeBlock`
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
        type: 'github' as const,
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz',
        urlType: 'archive' as const,
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
      fileContent: missingUrlFormula,
      upgrade,
    });

    expect(newContent).toBe(missingUrlFormula);
  });

  it('returns unchanged content if sha256 field in Formula file is invalid', async () => {
    const invalidSha256Formula = codeBlock`
      class Ibazel < Formula
      desc 'IBazel is a tool for building Bazel targets when source files change.'
      homepage 'https://github.com/bazelbuild/bazel-watcher'
      url "https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz"
      sha256 ???26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4'
      end
    `;

    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        type: 'github' as const,
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz',
        urlType: 'archive' as const,
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
      fileContent: invalidSha256Formula,
      upgrade,
    });

    expect(newContent).toBe(invalidSha256Formula);
  });

  it('returns unchanged content if sha256 field in Formula file is missing', async () => {
    const missingSha256Formula = codeBlock`
      class Ibazel < Formula
      desc 'IBazel is a tool for building Bazel targets when source files change.'
      homepage 'https://github.com/bazelbuild/bazel-watcher'
      url "https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz"
      end
    `;

    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        type: 'github' as const,
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz',
        urlType: 'archive' as const,
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
      fileContent: missingSha256Formula,
      upgrade,
    });

    expect(newContent).toBe(missingSha256Formula);
  });

  it('returns unchanged content if both got requests fail', async () => {
    const upgrade = {
      currentValue: 'v0.16.1',
      depName: 'Aide',
      managerData: {
        type: 'github' as const,
        ownerName: 'aide',
        repoName: 'aide',
        sha256:
          '0f2b7cecc70c1a27d35c06c98804fcdb9f326630de5d035afc447122186010b7',
        url: 'https://github.com/aide/aide/releases/download/v0.16.1/aide-0.16.1.tar.gz',
        urlType: 'releases' as const,
      },
      newValue: 'v0.17.7',
    };
    httpMock
      .scope(baseUrl)
      .get('/aide/aide/releases/download/v0.17.7/aide-0.17.7.tar.gz')
      .replyWithError('')
      .get('/aide/aide/archive/refs/tags/v0.17.7.tar.gz')
      .replyWithError('');

    const newContent = await updateDependency({
      fileContent: aide,
      upgrade,
    });

    expect(newContent).toBe(aide);
  });

  it('returns unchanged content if managerData is missing required fields', async () => {
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        type: 'github' as const,
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        sha256: null,
        url: null,
      },
      newValue: 'v0.9.3',
    };

    const newContent = await updateDependency({
      fileContent: ibazel,
      upgrade,
    });

    expect(newContent).toBe(ibazel);
  });

  it('returns unchanged content for unknown handler type', async () => {
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        type: 'unknown' as never,
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz',
      },
      newValue: 'v0.9.3',
    };

    const newContent = await updateDependency({
      fileContent: ibazel,
      upgrade,
    });

    expect(newContent).toBe(ibazel);
  });

  it('returns unchanged content if newValue is missing', async () => {
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        type: 'github' as const,
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz',
      },
      newValue: undefined as never,
    };

    const newContent = await updateDependency({
      fileContent: ibazel,
      upgrade,
    });

    expect(newContent).toBe(ibazel);
  });

  it('returns unchanged content if handler buildArchiveUrls returns null', async () => {
    const mockHandler = {
      type: 'github',
      parseUrl: vi.fn().mockReturnValue({
        type: 'github',
        currentValue: 'v0.8.2',
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        urlType: 'archive',
      }),
      buildArchiveUrls: vi.fn().mockReturnValue(null),
      createDependency: vi.fn(),
    };

    vi.spyOn(handlers, 'findHandlerByType').mockReturnValue(
      mockHandler as never,
    );

    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      managerData: {
        type: 'github' as const,
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        sha256:
          '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        url: 'https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz',
      },
      newValue: 'v0.9.3',
    };

    const newContent = await updateDependency({
      fileContent: ibazel,
      upgrade,
    });

    expect(newContent).toBe(ibazel);
    expect(mockHandler.buildArchiveUrls).toHaveBeenCalled();
  });
});
