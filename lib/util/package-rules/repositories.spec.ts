import { RepositoriesMatcher } from './repositories';

describe('util/package-rules/repositories', () => {
  const repositoryMatcher = new RepositoriesMatcher();

  describe('match', () => {
    it('should return null if match repositories is not defined', () => {
      const result = repositoryMatcher.matches(
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
      const result = repositoryMatcher.matches(
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
      const result = repositoryMatcher.matches(
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
      const result = repositoryMatcher.matches(
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
      const result = repositoryMatcher.matches(
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
      const result = repositoryMatcher.matches(
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
      const result = repositoryMatcher.matches(
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
      const result = repositoryMatcher.matches(
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
    it('should return false if exclude repository is not defined', () => {
      const result = repositoryMatcher.matches(
        {
          repository: undefined,
        },
        {
          matchRepositories: ['!org/repo'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should return false if exclude repository matches regex pattern', () => {
      const result = repositoryMatcher.matches(
        {
          repository: 'org/repo',
        },
        {
          matchRepositories: ['!/^org/repo$/'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should return true if exclude repository has invalid regex pattern', () => {
      const result = repositoryMatcher.matches(
        {
          repository: 'org/repo',
        },
        {
          matchRepositories: ['!/[/'],
        },
      );
      expect(result).toBeTrue();
    });

    it('should return true if exclude repository does not match regex pattern', () => {
      const result = repositoryMatcher.matches(
        {
          repository: 'org/repo',
        },
        {
          matchRepositories: ['!/^org/other-repo$/'],
        },
      );
      expect(result).toBeTrue();
    });

    it('should return false if exclude repository matches minimatch pattern', () => {
      const result = repositoryMatcher.matches(
        {
          repository: 'org/repo',
        },
        {
          matchRepositories: ['!org/**'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should return true if exclude repository does not match minimatch pattern', () => {
      const result = repositoryMatcher.matches(
        {
          repository: 'org/repo',
        },
        {
          matchRepositories: ['!other-org/**'],
        },
      );
      expect(result).toBeTrue();
    });

    it('should return false if exclude repository matches at least one pattern', () => {
      const result = repositoryMatcher.matches(
        {
          repository: 'org/repo-archived',
        },
        {
          matchRepositories: ['!/^org/repo$/', '!**/*-archived'],
        },
      );
      expect(result).toBeFalse();
    });
  });
});
