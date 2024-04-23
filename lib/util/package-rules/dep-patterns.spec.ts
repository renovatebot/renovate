import { DepPatternsMatcher } from './dep-patterns';

describe('util/package-rules/dep-patterns', () => {
  const depPatternsMatcher = new DepPatternsMatcher();

  describe('match', () => {
    it('should return false if depName is not defined', () => {
      const result = depPatternsMatcher.matches(
        {
          depName: undefined,
        },
        {
          matchDepPatterns: ['@opentelemetry/http'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should massage wildcards', () => {
      const result = depPatternsMatcher.matches(
        {
          depName: 'http',
        },
        {
          matchDepPatterns: ['*'],
        },
      );
      expect(result).toBeTrue();
    });

    it('should convert to regex', () => {
      const result = depPatternsMatcher.matches(
        {
          depName: 'http',
        },
        {
          matchDepPatterns: ['^h'],
        },
      );
      expect(result).toBeTrue();
    });
  });

  describe('exclude', () => {
    it('should return false if depName is not defined', () => {
      const result = depPatternsMatcher.excludes(
        {
          depName: undefined,
        },
        {
          excludeDepPatterns: ['@opentelemetry/http'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should massage wildcards', () => {
      const result = depPatternsMatcher.excludes(
        {
          depName: 'http',
        },
        {
          excludeDepPatterns: ['*'],
        },
      );
      expect(result).toBeTrue();
    });

    it('should convert to regex', () => {
      const result = depPatternsMatcher.excludes(
        {
          depName: 'http',
        },
        {
          excludeDepPatterns: ['^h'],
        },
      );
      expect(result).toBeTrue();
    });
  });
});
