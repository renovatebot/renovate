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
  });
});
