import { logger } from '../../../../test/util';
import {
  dockerDependency,
  extractDepFromTarget,
  gitDependency,
  goDependency,
  httpDependency,
  parseArchiveUrl,
} from './common';

describe('modules/manager/bazel/common', () => {
  test('parseUrl', () => {
    expect(parseArchiveUrl('')).toBeNull();
    expect(parseArchiveUrl(null)).toBeNull();
    expect(parseArchiveUrl(null)).toBeNull();
    expect(parseArchiveUrl('https://example.com/')).toBeNull();
    expect(parseArchiveUrl('https://github.com/foo/bar')).toBeNull();

    expect(
      parseArchiveUrl(
        'https://github.com/foo/bar/archive/abcdef0123abcdef0123abcdef0123abcdef0123.tar.gz'
      )
    ).toEqual({
      datasource: 'github-tags',
      repo: 'foo/bar',
      currentValue: 'abcdef0123abcdef0123abcdef0123abcdef0123',
    });

    expect(
      parseArchiveUrl(
        'https://github.com/foo/bar/releases/download/1.2.3/foobar-1.2.3.tar.gz'
      )
    ).toEqual({
      datasource: 'github-releases',
      repo: 'foo/bar',
      currentValue: '1.2.3',
    });
  });

  test('gitDependency', () => {
    expect(gitDependency({ rule: 'foo_bar', name: 'foo_bar' })).toBeNull();

    expect(
      gitDependency({ rule: 'git_repository', name: 'foo_bar' })
    ).toBeNull();

    expect(
      gitDependency({ rule: 'git_repository', name: 'foo_bar', tag: '1.2.3' })
    ).toBeNull();

    expect(
      gitDependency({
        rule: 'git_repository',
        name: 'foo_bar',
        tag: '1.2.3',
        remote: 'https://github.com/foo/bar',
      })
    ).toEqual({
      datasource: 'github-releases',
      depType: 'git_repository',
      depName: 'foo_bar',
      packageName: 'foo/bar',
      currentValue: '1.2.3',
    });

    expect(
      gitDependency({
        rule: 'git_repository',
        name: 'foo_bar',
        commit: 'abcdef0123abcdef0123abcdef0123abcdef0123',
        remote: 'https://github.com/foo/bar',
      })
    ).toEqual({
      datasource: 'github-releases',
      depType: 'git_repository',
      depName: 'foo_bar',
      packageName: 'foo/bar',
      currentDigest: 'abcdef0123abcdef0123abcdef0123abcdef0123',
    });
  });

  test('goDependency', () => {
    expect(goDependency({ rule: 'foo_bar', name: 'foo_bar' })).toBeNull();

    expect(goDependency({ rule: 'go_repository', name: 'foo_bar' })).toBeNull();

    expect(
      goDependency({ rule: 'go_repository', name: 'foo_bar', tag: '1.2.3' })
    ).toBeNull();

    expect(
      goDependency({
        rule: 'go_repository',
        name: 'foo_bar',
        tag: '1.2.3',
        importpath: 'foo/bar/baz',
      })
    ).toEqual({
      datasource: 'go',
      depType: 'go_repository',
      depName: 'foo_bar',
      packageName: 'foo/bar/baz',
      currentValue: '1.2.3',
    });

    expect(
      goDependency({
        rule: 'go_repository',
        name: 'foo_bar',
        commit: 'abcdef0123abcdef0123abcdef0123abcdef0123',
        importpath: 'foo/bar/baz',
      })
    ).toEqual({
      datasource: 'go',
      depType: 'go_repository',
      depName: 'foo_bar',
      packageName: 'foo/bar/baz',
      currentValue: 'v0.0.0',
      currentDigest: 'abcdef0123abcdef0123abcdef0123abcdef0123',
      currentDigestShort: 'abcdef0',
      digestOneAndOnly: true,
    });

    expect(
      goDependency({
        rule: 'go_repository',
        name: 'foo_bar',
        tag: '1.2.3',
        importpath: 'foo/bar/baz',
        remote: 'https://github.com/foo/bar',
      })
    ).toEqual({
      datasource: 'go',
      depType: 'go_repository',
      depName: 'foo_bar',
      packageName: 'github.com/foo/bar',
      currentValue: '1.2.3',
    });

    expect(
      goDependency({
        rule: 'go_repository',
        name: 'foo_bar',
        tag: '1.2.3',
        importpath: 'foo/bar/baz',
        remote: 'https://example.com/foo/bar',
      })
    ).toEqual({
      datasource: 'go',
      depType: 'go_repository',
      depName: 'foo_bar',
      packageName: 'foo/bar/baz',
      currentValue: '1.2.3',
      skipReason: 'unsupported-remote',
    });
  });

  test('httpDependency', () => {
    expect(httpDependency({ rule: 'foo_bar', name: 'foo_bar' })).toBeNull();

    expect(
      httpDependency({ rule: 'http_archive', name: 'foo_bar' })
    ).toBeNull();

    expect(
      httpDependency({
        rule: 'http_archive',
        name: 'foo_bar',
        sha256: 'abcdef0123abcdef0123abcdef0123abcdef0123',
      })
    ).toBeNull();

    expect(
      httpDependency({
        rule: 'http_archive',
        name: 'foo_bar',
        sha256: 'abcdef0123abcdef0123abcdef0123abcdef0123',
        url: 'https://github.com/foo/bar/archive/abcdef0123abcdef0123abcdef0123abcdef0123.tar.gz',
      })
    ).toEqual({
      currentDigest: 'abcdef0123abcdef0123abcdef0123abcdef0123',
      datasource: 'github-tags',
      depName: 'foo_bar',
      depType: 'http_archive',
      packageName: 'foo/bar',
    });

    expect(
      httpDependency({
        rule: 'http_archive',
        name: 'foo_bar',
        sha256: 'abcdef0123abcdef0123abcdef0123abcdef0123',
        urls: [
          'https://example.com/foo/bar',
          'https://github.com/foo/bar/archive/abcdef0123abcdef0123abcdef0123abcdef0123.tar.gz',
        ],
      })
    ).toEqual({
      currentDigest: 'abcdef0123abcdef0123abcdef0123abcdef0123',
      datasource: 'github-tags',
      depName: 'foo_bar',
      depType: 'http_archive',
      packageName: 'foo/bar',
    });

    expect(
      httpDependency({
        rule: 'http_archive',
        name: 'foo_bar',
        sha256: 'abcdef0123abcdef0123abcdef0123abcdef0123',
        url: 'https://github.com/foo/bar/releases/download/1.2.3/foobar-1.2.3.tar.gz',
      })
    ).toEqual({
      currentValue: '1.2.3',
      datasource: 'github-releases',
      depName: 'foo_bar',
      depType: 'http_archive',
      packageName: 'foo/bar',
    });

    expect(
      httpDependency({
        rule: 'http_archive',
        name: 'foo_bar',
        sha256: 'abcdef0123abcdef0123abcdef0123abcdef0123',
        urls: [
          'https://example.com/foo/bar',
          'https://github.com/foo/bar/releases/download/1.2.3/foobar-1.2.3.tar.gz',
        ],
      })
    ).toEqual({
      currentValue: '1.2.3',
      datasource: 'github-releases',
      depName: 'foo_bar',
      depType: 'http_archive',
      packageName: 'foo/bar',
    });
  });

  test('dockerDependency', () => {
    expect(dockerDependency({ rule: 'foo_bar', name: 'foo_bar' })).toBeNull();

    expect(
      dockerDependency({
        rule: 'container_pull',
        name: 'foo_bar',
        tag: '1.2.3',
        digest: 'abcdef0123abcdef0123abcdef0123abcdef0123',
        repository: 'example.com/foo/bar',
        registry: 'https://example.com',
      })
    ).toEqual({
      currentDigest: 'abcdef0123abcdef0123abcdef0123abcdef0123',
      currentValue: '1.2.3',
      datasource: 'docker',
      depName: 'foo_bar',
      depType: 'container_pull',
      packageName: 'example.com/foo/bar',
      registryUrls: ['https://example.com'],
      versioning: 'docker',
    });
  });

  test('extractDepFromTarget', () => {
    expect(extractDepFromTarget({ rule: 'foo', name: 'bar' })).toBeNull();

    expect(
      extractDepFromTarget({
        rule: 'git_repository',
        name: 'foo_bar',
        tag: '1.2.3',
        remote: 'https://github.com/foo/bar',
      })
    ).toEqual({
      datasource: 'github-releases',
      depType: 'git_repository',
      depName: 'foo_bar',
      packageName: 'foo/bar',
      currentValue: '1.2.3',
    });

    expect(logger.logger.warn).toHaveBeenCalledWith(
      'Bazel dependency extractor function not found for foo'
    );
  });
});
