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

    // Archive of a commit.
    expect(
      parseArchiveUrl(
        'https://github.com/foo/bar/archive/abcdef0123abcdef0123abcdef0123abcdef0123.tar.gz'
      )
    ).toEqual({
      datasource: 'github-tags',
      repo: 'foo/bar',
      currentValue: 'abcdef0123abcdef0123abcdef0123abcdef0123',
    });

    // Archive of a release
    expect(
      parseArchiveUrl(
        'https://github.com/foo/bar/releases/download/1.2.3/foobar-1.2.3.tar.gz'
      )
    ).toEqual({
      datasource: 'github-releases',
      repo: 'foo/bar',
      currentValue: '1.2.3',
    });

    // Archive of a tag.
    expect(
      parseArchiveUrl(
        'https://github.com/aspect-build/rules_js/archive/refs/tags/v1.1.2.tar.gz'
      )
    ).toEqual({
      datasource: 'github-tags',
      repo: 'aspect-build/rules_js',
      currentValue: 'v1.1.2',
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

    expect(
      httpDependency({
        rule: 'http_archive',
        name: 'aspect_rules_js',
        sha256:
          'db9f446752fe4100320cf8487e8fd476b9af0adf6b99b601bcfd70b289bb0598',
        urls: [
          'https://github.com/aspect-build/rules_js/archive/refs/tags/v1.1.2.tar.gz',
        ],
      })
    ).toEqual({
      currentValue: 'v1.1.2',
      datasource: 'github-tags',
      depName: 'aspect_rules_js',
      depType: 'http_archive',
      packageName: 'aspect-build/rules_js',
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

  describe('extractDepFromTarget', () => {
    it('returns null for unknown rule type', () => {
      expect(extractDepFromTarget({ rule: 'foo', name: 'bar' })).toBeNull();
    });

    it('extracts from git_repository', () => {
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
    });

    it('extracts from http_archive', () => {
      expect(
        extractDepFromTarget({
          rule: 'http_archive',
          name: 'rules_nodejs',
          sha256:
            '5aef09ed3279aa01d5c928e3beb248f9ad32dde6aafe6373a8c994c3ce643064',
          urls: [
            'https://github.com/bazelbuild/rules_nodejs/releases/download/5.5.3/rules_nodejs-core-5.5.3.tar.gz',
          ],
        })
      ).toEqual({
        datasource: 'github-releases',
        depType: 'http_archive',
        depName: 'rules_nodejs',
        packageName: 'bazelbuild/rules_nodejs',
        currentValue: '5.5.3',
      });
    });
  });
});
