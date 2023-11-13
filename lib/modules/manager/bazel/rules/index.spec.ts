import { parseArchiveUrl } from './http';
import { extractDepsFromFragmentData } from '.';

describe('modules/manager/bazel/rules/index', () => {
  it('parses archiveUrl', () => {
    expect(parseArchiveUrl('')).toBeNull();
    expect(parseArchiveUrl(null)).toBeNull();
    expect(parseArchiveUrl(null)).toBeNull();
    expect(parseArchiveUrl('https://example.com/')).toBeNull();
    expect(parseArchiveUrl('https://github.com/foo/bar')).toBeNull();

    // Archive of a commit.
    expect(
      parseArchiveUrl(
        'https://github.com/foo/bar/archive/abcdef0123abcdef0123abcdef0123abcdef0123.tar.gz',
      ),
    ).toEqual({
      datasource: 'github-tags',
      packageName: 'foo/bar',
      currentDigest: 'abcdef0123abcdef0123abcdef0123abcdef0123',
    });

    // Archive of a release
    expect(
      parseArchiveUrl(
        'https://github.com/foo/bar/releases/download/1.2.3/foobar-1.2.3.tar.gz',
      ),
    ).toEqual({
      datasource: 'github-releases',
      packageName: 'foo/bar',
      currentValue: '1.2.3',
    });

    // Archive of a tag.
    expect(
      parseArchiveUrl(
        'https://github.com/aspect-build/rules_js/archive/refs/tags/v1.1.2.tar.gz',
      ),
    ).toEqual({
      datasource: 'github-tags',
      packageName: 'aspect-build/rules_js',
      currentValue: 'v1.1.2',
    });
  });

  describe('git', () => {
    it('extracts git dependencies', () => {
      expect(
        extractDepsFromFragmentData({ rule: 'foo_bar', name: 'foo_bar' }),
      ).toBeEmptyArray();

      expect(
        extractDepsFromFragmentData({
          rule: 'git_repository',
          name: 'foo_bar',
        }),
      ).toBeEmptyArray();

      expect(
        extractDepsFromFragmentData({
          rule: 'git_repository',
          name: 'foo_bar',
          tag: '1.2.3',
        }),
      ).toBeEmptyArray();

      expect(
        extractDepsFromFragmentData({
          rule: 'git_repository',
          name: 'foo_bar',
          tag: '1.2.3',
          remote: 'https://github.com/foo/bar',
        }),
      ).toEqual([
        {
          datasource: 'github-releases',
          depType: 'git_repository',
          depName: 'foo_bar',
          packageName: 'foo/bar',
          currentValue: '1.2.3',
        },
      ]);

      expect(
        extractDepsFromFragmentData({
          rule: 'git_repository',
          name: 'foo_bar',
          commit: 'abcdef0123abcdef0123abcdef0123abcdef0123',
          remote: 'https://github.com/foo/bar',
        }),
      ).toEqual([
        {
          datasource: 'github-releases',
          depType: 'git_repository',
          depName: 'foo_bar',
          packageName: 'foo/bar',
          currentDigest: 'abcdef0123abcdef0123abcdef0123abcdef0123',
        },
      ]);

      expect(
        extractDepsFromFragmentData({
          rule: 'git_repository',
          name: 'foo_bar',
          tag: '1.2.3',
          remote: 'https://gitlab.com/foo/bar',
        }),
      ).toMatchObject([
        {
          currentValue: '1.2.3',
          depName: 'foo_bar',
          depType: 'git_repository',
          skipReason: 'unsupported-datasource',
        },
      ]);
    });
  });

  describe('go', () => {
    it('extracts go dependencies', () => {
      expect(
        extractDepsFromFragmentData({ rule: 'foo_bar', name: 'foo_bar' }),
      ).toBeEmptyArray();

      expect(
        extractDepsFromFragmentData({ rule: 'go_repository', name: 'foo_bar' }),
      ).toBeEmptyArray();

      expect(
        extractDepsFromFragmentData({
          rule: 'go_repository',
          name: 'foo_bar',
          tag: '1.2.3',
        }),
      ).toBeEmptyArray();

      expect(
        extractDepsFromFragmentData({
          rule: 'go_repository',
          name: 'foo_bar',
          tag: '1.2.3',
          importpath: 'foo/bar/baz',
        }),
      ).toEqual([
        {
          datasource: 'go',
          depType: 'go_repository',
          depName: 'foo_bar',
          packageName: 'foo/bar/baz',
          currentValue: '1.2.3',
        },
      ]);

      expect(
        extractDepsFromFragmentData({
          rule: 'go_repository',
          name: 'foo_bar',
          commit: 'abcdef0123abcdef0123abcdef0123abcdef0123',
          importpath: 'foo/bar/baz',
        }),
      ).toEqual([
        {
          datasource: 'go',
          depType: 'go_repository',
          depName: 'foo_bar',
          packageName: 'foo/bar/baz',
          currentDigest: 'abcdef0123abcdef0123abcdef0123abcdef0123',
          digestOneAndOnly: true,
        },
      ]);

      expect(
        extractDepsFromFragmentData({
          rule: 'go_repository',
          name: 'foo_bar',
          tag: '1.2.3',
          importpath: 'foo/bar/baz',
          remote: 'https://github.com/foo/bar',
        }),
      ).toEqual([
        {
          datasource: 'go',
          depType: 'go_repository',
          depName: 'foo_bar',
          packageName: 'github.com/foo/bar',
          currentValue: '1.2.3',
        },
      ]);

      expect(
        extractDepsFromFragmentData({
          rule: 'go_repository',
          name: 'foo_bar',
          tag: '1.2.3',
          importpath: 'foo/bar/baz',
          remote: 'https://example.com/foo/bar',
        }),
      ).toEqual([
        {
          datasource: 'go',
          depType: 'go_repository',
          depName: 'foo_bar',
          packageName: 'foo/bar/baz',
          currentValue: '1.2.3',
          skipReason: 'unsupported-remote',
        },
      ]);
    });
  });

  describe('http', () => {
    it('extracts http dependencies', () => {
      expect(
        extractDepsFromFragmentData({ rule: 'foo_bar', name: 'foo_bar' }),
      ).toBeEmptyArray();

      expect(
        extractDepsFromFragmentData({ rule: 'http_archive', name: 'foo_bar' }),
      ).toBeEmptyArray();

      expect(
        extractDepsFromFragmentData({
          rule: 'http_archive',
          name: 'foo_bar',
          sha256: 'abcdef0123abcdef0123abcdef0123abcdef0123',
        }),
      ).toBeEmptyArray();

      expect(
        extractDepsFromFragmentData({
          rule: 'http_archive',
          name: 'foo_bar',
          sha256: 'abcdef0123abcdef0123abcdef0123abcdef0123',
          url: 'https://github.com/foo/bar/archive/abcdef0123abcdef0123abcdef0123abcdef0123.tar.gz',
        }),
      ).toEqual([
        {
          currentDigest: 'abcdef0123abcdef0123abcdef0123abcdef0123',
          datasource: 'github-tags',
          depName: 'foo_bar',
          depType: 'http_archive',
          packageName: 'foo/bar',
        },
      ]);

      expect(
        extractDepsFromFragmentData({
          rule: 'http_archive',
          name: 'foo_bar',
          sha256: 'abcdef0123abcdef0123abcdef0123abcdef0123',
          urls: [
            'https://example.com/foo/bar',
            'https://github.com/foo/bar/archive/abcdef0123abcdef0123abcdef0123abcdef0123.tar.gz',
          ],
        }),
      ).toEqual([
        {
          currentDigest: 'abcdef0123abcdef0123abcdef0123abcdef0123',
          datasource: 'github-tags',
          depName: 'foo_bar',
          depType: 'http_archive',
          packageName: 'foo/bar',
        },
      ]);

      expect(
        extractDepsFromFragmentData({
          rule: 'http_archive',
          name: 'foo_bar',
          sha256: 'abcdef0123abcdef0123abcdef0123abcdef0123',
          url: 'https://github.com/foo/bar/releases/download/1.2.3/foobar-1.2.3.tar.gz',
        }),
      ).toEqual([
        {
          currentValue: '1.2.3',
          datasource: 'github-releases',
          depName: 'foo_bar',
          depType: 'http_archive',
          packageName: 'foo/bar',
        },
      ]);

      expect(
        extractDepsFromFragmentData({
          rule: 'http_archive',
          name: 'foo_bar',
          sha256: 'abcdef0123abcdef0123abcdef0123abcdef0123',
          urls: [
            'https://example.com/foo/bar',
            'https://github.com/foo/bar/releases/download/1.2.3/foobar-1.2.3.tar.gz',
          ],
        }),
      ).toEqual([
        {
          currentValue: '1.2.3',
          datasource: 'github-releases',
          depName: 'foo_bar',
          depType: 'http_archive',
          packageName: 'foo/bar',
        },
      ]);

      expect(
        extractDepsFromFragmentData({
          rule: 'http_archive',
          name: 'aspect_rules_js',
          sha256:
            'db9f446752fe4100320cf8487e8fd476b9af0adf6b99b601bcfd70b289bb0598',
          urls: [
            'https://github.com/aspect-build/rules_js/archive/refs/tags/v1.1.2.tar.gz',
          ],
        }),
      ).toEqual([
        {
          currentValue: 'v1.1.2',
          datasource: 'github-tags',
          depName: 'aspect_rules_js',
          depType: 'http_archive',
          packageName: 'aspect-build/rules_js',
        },
      ]);
    });
  });

  describe('docker', () => {
    it('extracts docker dependencies', () => {
      expect(
        extractDepsFromFragmentData({ rule: 'foo_bar', name: 'foo_bar' }),
      ).toBeEmptyArray();

      expect(
        extractDepsFromFragmentData({
          rule: 'container_pull',
          name: 'foo_bar',
          tag: '1.2.3',
          digest: 'abcdef0123abcdef0123abcdef0123abcdef0123',
          repository: 'example.com/foo/bar',
          registry: 'https://example.com',
        }),
      ).toEqual([
        {
          currentDigest: 'abcdef0123abcdef0123abcdef0123abcdef0123',
          currentValue: '1.2.3',
          datasource: 'docker',
          depName: 'foo_bar',
          depType: 'container_pull',
          packageName: 'example.com/foo/bar',
          registryUrls: ['https://example.com'],
          versioning: 'docker',
        },
      ]);
    });
  });

  describe('oci', () => {
    it('extracts oci dependencies', () => {
      expect(
        extractDepsFromFragmentData({ rule: 'foo_bar', name: 'foo_bar' }),
      ).toBeEmptyArray();

      expect(
        extractDepsFromFragmentData({
          rule: 'oci_pull',
          name: 'foo_bar',
          tag: '1.2.3',
          digest: 'abcdef0123abcdef0123abcdef0123abcdef0123',
          image: 'example.com/foo/bar',
        }),
      ).toEqual([
        {
          currentDigest: 'abcdef0123abcdef0123abcdef0123abcdef0123',
          currentValue: '1.2.3',
          datasource: 'docker',
          depName: 'foo_bar',
          depType: 'oci_pull',
          packageName: 'example.com/foo/bar',
          versioning: 'docker',
        },
      ]);
    });
  });

  describe('maven', () => {
    it('extracts maven dependencies', () => {
      expect(
        extractDepsFromFragmentData({
          rule: 'maven_install',
          artifacts: [
            'com.example1:foo:1.1.1',
            {
              _function: 'maven.artifact',
              group: 'com.example2',
              artifact: 'bar',
              version: '2.2.2',
            },
            {
              _function: 'maven.artifact',
              '0': 'com.example3',
              '1': 'baz',
              '2': '3.3.3',
            },
          ],
          repositories: [
            'https://example1.com/maven2',
            'https://example2.com/maven2',
          ],
        }),
      ).toEqual([
        {
          currentValue: '1.1.1',
          datasource: 'maven',
          versioning: 'gradle',
          depType: 'maven_install',
          depName: 'com.example1:foo',
          registryUrls: [
            'https://example1.com/maven2',
            'https://example2.com/maven2',
          ],
        },
        {
          currentValue: '2.2.2',
          datasource: 'maven',
          versioning: 'gradle',
          depType: 'maven_install',
          depName: 'com.example2:bar',
          registryUrls: [
            'https://example1.com/maven2',
            'https://example2.com/maven2',
          ],
        },
        {
          currentValue: '3.3.3',
          datasource: 'maven',
          versioning: 'gradle',
          depType: 'maven_install',
          depName: 'com.example3:baz',
          registryUrls: [
            'https://example1.com/maven2',
            'https://example2.com/maven2',
          ],
        },
      ]);
    });
  });
});
