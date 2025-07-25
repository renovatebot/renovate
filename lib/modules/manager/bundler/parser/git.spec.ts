import type { KvArgs } from './common';
import { extractGitRefData } from './git';

describe('modules/manager/bundler/parser/git', () => {
  describe('extractGitRefData', () => {
    it('parses git with ref (commit hash)', () => {
      const kvArgs: KvArgs = {
        git: 'https://github.com/user/repo.git',
        ref: 'abc123456789def',
      };

      const result = extractGitRefData(kvArgs);

      expect(result).toEqual({
        datasource: 'git-refs',
        packageName: 'https://github.com/user/repo.git',
        sourceUrl: 'https://github.com/user/repo.git',
        currentDigest: 'abc123456789def',
      });
    });

    it('parses git with tag', () => {
      const kvArgs: KvArgs = {
        git: 'https://github.com/user/repo.git',
        tag: 'v1.2.3',
      };

      const result = extractGitRefData(kvArgs);

      expect(result).toEqual({
        datasource: 'git-refs',
        packageName: 'https://github.com/user/repo.git',
        sourceUrl: 'https://github.com/user/repo.git',
        currentValue: 'v1.2.3',
      });
    });

    it('parses github with branch', () => {
      const kvArgs: KvArgs = {
        github: 'user/repo',
        branch: 'main',
      };

      const result = extractGitRefData(kvArgs);

      expect(result).toEqual({
        datasource: 'git-refs',
        packageName: 'https://github.com/user/repo',
        sourceUrl: 'https://github.com/user/repo',
        currentValue: 'main',
      });
    });

    it('parses git without any ref/tag/branch', () => {
      const kvArgs: KvArgs = {
        git: 'https://github.com/user/repo.git',
      };

      const result = extractGitRefData(kvArgs);

      expect(result).toEqual({
        datasource: 'git-refs',
        packageName: 'https://github.com/user/repo.git',
        sourceUrl: 'https://github.com/user/repo.git',
      });
    });

    it('parses github without any ref/tag/branch', () => {
      const kvArgs: KvArgs = {
        github: 'user/repo',
      };

      const result = extractGitRefData(kvArgs);

      expect(result).toEqual({
        datasource: 'git-refs',
        packageName: 'https://github.com/user/repo',
        sourceUrl: 'https://github.com/user/repo',
      });
    });

    it('prioritizes ref over tag and branch', () => {
      const kvArgs: KvArgs = {
        git: 'https://github.com/user/repo.git',
        ref: 'abc123456789def',
        tag: 'v1.2.3',
        branch: 'main',
      };

      const result = extractGitRefData(kvArgs);

      expect(result).toEqual({
        datasource: 'git-refs',
        packageName: 'https://github.com/user/repo.git',
        sourceUrl: 'https://github.com/user/repo.git',
        currentDigest: 'abc123456789def',
      });
    });

    it('prioritizes tag over branch when no ref', () => {
      const kvArgs: KvArgs = {
        git: 'https://github.com/user/repo.git',
        tag: 'v1.2.3',
        branch: 'main',
      };

      const result = extractGitRefData(kvArgs);

      expect(result).toEqual({
        datasource: 'git-refs',
        packageName: 'https://github.com/user/repo.git',
        sourceUrl: 'https://github.com/user/repo.git',
        currentValue: 'v1.2.3',
      });
    });

    it('prioritizes git over github when both present', () => {
      const kvArgs: KvArgs = {
        git: 'https://github.com/user/repo.git',
        github: 'user/other-repo',
        ref: 'abc123456789def',
      };

      const result = extractGitRefData(kvArgs);

      expect(result).toEqual({
        datasource: 'git-refs',
        packageName: 'https://github.com/user/repo.git',
        sourceUrl: 'https://github.com/user/repo.git',
        currentDigest: 'abc123456789def',
      });
    });

    it('returns null when no git or github specified', () => {
      const kvArgs: KvArgs = {
        source: 'https://rubygems.org',
        group: 'development',
      };

      const result = extractGitRefData(kvArgs);

      expect(result).toBeNull();
    });

    it('returns null when git/github are not strings', () => {
      const kvArgs: KvArgs = {
        git: Symbol('not-a-string'),
        github: ['not', 'a', 'string'],
      };

      const result = extractGitRefData(kvArgs);

      expect(result).toBeNull();
    });

    it('handles empty string git parameter', () => {
      const kvArgs: KvArgs = {
        git: '',
      };

      const result = extractGitRefData(kvArgs);

      expect(result).toEqual({
        datasource: 'git-refs',
        packageName: '',
        sourceUrl: '',
      });
    });

    it('handles empty string github parameter', () => {
      const kvArgs: KvArgs = {
        github: '',
      };

      const result = extractGitRefData(kvArgs);

      expect(result).toEqual({
        datasource: 'git-refs',
        packageName: 'https://github.com/',
        sourceUrl: 'https://github.com/',
      });
    });

    it('handles non-string ref/tag/branch values', () => {
      const kvArgs: KvArgs = {
        git: 'https://github.com/user/repo.git',
        ref: Symbol('not-a-string'),
        tag: ['not', 'a', 'string'],
        branch: '1.2.3',
      };

      const result = extractGitRefData(kvArgs);

      expect(result).toEqual({
        datasource: 'git-refs',
        currentValue: '1.2.3',
        packageName: 'https://github.com/user/repo.git',
        sourceUrl: 'https://github.com/user/repo.git',
      });
    });
  });
});
