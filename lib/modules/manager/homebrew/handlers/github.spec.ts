import { expect } from 'vitest';
import { GitHubUrlHandler } from './github';

describe('modules/manager/homebrew/handlers/github', () => {
  const handler = new GitHubUrlHandler();

  describe('parseUrl', () => {
    it('returns null for empty string', () => {
      expect(handler.parseUrl('')).toBeNull();
    });

    it.each([null, undefined])(
      'returns null for non-string input: %s',
      (input) => {
        expect(handler.parseUrl(input as never)).toBeNull();
      },
    );

    it('parses valid releases URL', () => {
      const result = handler.parseUrl(
        'https://github.com/aide/aide/releases/download/v0.16.1/aide-0.16.1.tar.gz',
      );

      expect(result).toEqual({
        type: 'github',
        currentValue: 'v0.16.1',
        ownerName: 'aide',
        repoName: 'aide',
        urlType: 'releases',
      });
    });

    it('parses valid archive URL', () => {
      const result = handler.parseUrl(
        'https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz',
      );

      expect(result).toEqual({
        type: 'github',
        currentValue: 'v0.8.2',
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        urlType: 'archive',
      });
    });
  });

  describe('buildArchiveUrls', () => {
    it('uses original version when semver.coerce fails', () => {
      const managerData = {
        type: 'github' as const,
        ownerName: 'owner',
        repoName: 'repo',
        sha256: 'abc123',
        url: 'https://github.com/owner/repo/archive/refs/tags/not-a-semver.tar.gz',
      };

      const urls = handler.buildArchiveUrls(managerData, 'also-not-semver');

      expect(urls).toEqual([
        'https://github.com/owner/repo/releases/download/also-not-semver/repo-also-not-semver.tar.gz',
        'https://github.com/owner/repo/archive/refs/tags/also-not-semver.tar.gz',
      ]);
    });

    it('uses coerced version for filename when semver succeeds', () => {
      const managerData = {
        type: 'github' as const,
        ownerName: 'owner',
        repoName: 'repo',
        sha256: 'abc123',
        url: 'https://github.com/owner/repo/archive/refs/tags/v1.2.3.tar.gz',
      };

      const urls = handler.buildArchiveUrls(managerData, 'v1.2.4');

      expect(urls).toEqual([
        'https://github.com/owner/repo/releases/download/v1.2.4/repo-1.2.4.tar.gz',
        'https://github.com/owner/repo/archive/refs/tags/v1.2.4.tar.gz',
      ]);
    });
  });

  describe('createDependency', () => {
    it('creates dependency with github-releases datasource for releases URL', () => {
      const parsed = {
        type: 'github' as const,
        currentValue: 'v0.16.1',
        ownerName: 'aide',
        repoName: 'aide',
        urlType: 'releases' as const,
      };

      const dep = handler.createDependency(
        parsed,
        '0f2b7cecc70c1a27d35c06c98804fcdb9f326630de5d035afc447122186010b7',
        'https://github.com/aide/aide/releases/download/v0.16.1/aide-0.16.1.tar.gz',
      );

      expect(dep).toMatchObject({
        datasource: 'github-releases',
        depName: 'aide/aide',
        currentValue: 'v0.16.1',
      });
    });

    it('creates dependency with github-tags datasource for archive URL', () => {
      const parsed = {
        type: 'github' as const,
        currentValue: 'v0.8.2',
        ownerName: 'bazelbuild',
        repoName: 'bazel-watcher',
        urlType: 'archive' as const,
      };

      const dep = handler.createDependency(
        parsed,
        '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
        'https://github.com/bazelbuild/bazel-watcher/archive/refs/tags/v0.8.2.tar.gz',
      );

      expect(dep).toMatchObject({
        datasource: 'github-tags',
        depName: 'bazelbuild/bazel-watcher',
        currentValue: 'v0.8.2',
      });
    });
  });
});
