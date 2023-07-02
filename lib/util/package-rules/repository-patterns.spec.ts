import { RepositoryPatternsMatcher } from './repository-patterns';

describe('util/package-rules/repository-patterns', () => {
  const packageNameMatcher = new RepositoryPatternsMatcher();

  describe('match', () => {
    it('should return false if repository is not defined', () => {
      const result = packageNameMatcher.matches(
        {
          repository: undefined,
        },
        {
          matchRepositoryPatterns: ['org/repo'],
        }
      );
      expect(result).toBeFalse();
    });

    it('should return false if repository does not match pattern', () => {
      const result = packageNameMatcher.matches(
        {
          repository: 'org/repo',
        },
        {
          matchRepositoryPatterns: ['org/other-repo'],
        }
      );
      expect(result).toBeFalse();
    });

    it('should return true if repository matches pattern', () => {
      const result = packageNameMatcher.matches(
        {
          repository: 'org/repo-archived',
        },
        {
          matchRepositoryPatterns: ['-archived$'],
        }
      );
      expect(result).toBeTrue();
    });
  });
});
