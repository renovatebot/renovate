import { RepositoriesMatcher } from './repositories';

describe('util/package-rules/repositories', () => {
  const packageNameMatcher = new RepositoriesMatcher();

  describe('match', () => {
    it('should return false if repository is not defined', () => {
      const result = packageNameMatcher.matches(
        {
          repository: undefined,
        },
        {
          matchRepositories: ['org/repo'],
        }
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
        }
      );
      expect(result).toBeTrue();
    });

    it('should return false if repository does not match regex pattern', () => {
      const result = packageNameMatcher.matches(
        {
          repository: 'org/repo',
        },
        {
          matchRepositories: ['/^org/other-repo$/'],
        }
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
        }
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
        }
      );
      expect(result).toBeFalse();
    });

    it('should return true if repository matches at least one of the matterns pattern', () => {
      const result = packageNameMatcher.matches(
        {
          repository: 'org/repo-archived',
        },
        {
          matchRepositories: ['/^org/repo$/', '**/*-archived'],
        }
      );
      expect(result).toBeTrue();
    });
  });
});
