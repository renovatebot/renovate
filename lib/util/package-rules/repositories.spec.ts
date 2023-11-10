import { RepositoriesMatcher } from './repositories';

describe('util/package-rules/repositories', () => {
  const packageNameMatcher = new RepositoriesMatcher();

  describe('match', () => {
    it('should return null if match repositories is not defined', () => {
      const result = packageNameMatcher.matches(
        {
          repository: 'org/repo',
        },
        {
          matchRepositories: undefined,
        },
      );
      expect(result).toBeNull();
    });

    it('should return false if repository is not defined', () => {
      const result = packageNameMatcher.matches(
        {
          repository: undefined,
        },
        {
          matchRepositories: ['org/repo'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should return true if repository matches regex pattern', () => {
      const result = packageNameMatcher.matches(
        {
          repository: 'org/repo',
        },
        {
          matchRepositories: ['/^org/repo$/'],
        },
      );
      expect(result).toBeTrue();
    });

    it('should return false if repository has invalid regex pattern', () => {
      const result = packageNameMatcher.matches(
        {
          repository: 'org/repo',
        },
        {
          matchRepositories: ['/[/'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should return false if repository does not match regex pattern', () => {
      const result = packageNameMatcher.matches(
        {
          repository: 'org/repo',
        },
        {
          matchRepositories: ['/^org/other-repo$/'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should return true if repository matches minimatch pattern', () => {
      const result = packageNameMatcher.matches(
        {
          repository: 'org/repo',
        },
        {
          matchRepositories: ['org/**'],
        },
      );
      expect(result).toBeTrue();
    });

    it('should return false if repository does not match minimatch pattern', () => {
      const result = packageNameMatcher.matches(
        {
          repository: 'org/repo',
        },
        {
          matchRepositories: ['other-org/**'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should return true if repository matches at least one pattern', () => {
      const result = packageNameMatcher.matches(
        {
          repository: 'org/repo-archived',
        },
        {
          matchRepositories: ['/^org/repo$/', '**/*-archived'],
        },
      );
      expect(result).toBeTrue();
    });
  });

  describe('excludes', () => {
    it('should return null if exclude repositories is not defined', () => {
      const result = packageNameMatcher.excludes(
        {
          repository: 'org/repo',
        },
        {
          excludeRepositories: undefined,
        },
      );
      expect(result).toBeNull();
    });

    it('should return false if exclude repository is not defined', () => {
      const result = packageNameMatcher.excludes(
        {
          repository: undefined,
        },
        {
          excludeRepositories: ['org/repo'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should return true if exclude repository matches regex pattern', () => {
      const result = packageNameMatcher.excludes(
        {
          repository: 'org/repo',
        },
        {
          excludeRepositories: ['/^org/repo$/'],
        },
      );
      expect(result).toBeTrue();
    });

    it('should return false if exclude repository has invalid regex pattern', () => {
      const result = packageNameMatcher.excludes(
        {
          repository: 'org/repo',
        },
        {
          excludeRepositories: ['/[/'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should return false if exclude repository does not match regex pattern', () => {
      const result = packageNameMatcher.excludes(
        {
          repository: 'org/repo',
        },
        {
          excludeRepositories: ['/^org/other-repo$/'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should return true if exclude repository matches minimatch pattern', () => {
      const result = packageNameMatcher.excludes(
        {
          repository: 'org/repo',
        },
        {
          excludeRepositories: ['org/**'],
        },
      );
      expect(result).toBeTrue();
    });

    it('should return false if exclude repository does not match minimatch pattern', () => {
      const result = packageNameMatcher.excludes(
        {
          repository: 'org/repo',
        },
        {
          excludeRepositories: ['other-org/**'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should return true if exclude repository matches at least one pattern', () => {
      const result = packageNameMatcher.excludes(
        {
          repository: 'org/repo-archived',
        },
        {
          excludeRepositories: ['/^org/repo$/', '**/*-archived'],
        },
      );
      expect(result).toBeTrue();
    });
  });
});
