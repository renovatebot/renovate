import { DepNameMatcher } from './dep-names';

describe('util/package-rules/dep-names', () => {
  const depNameMatcher = new DepNameMatcher();

  describe('match', () => {
    it('should return false if packageFile is not defined', () => {
      const result = depNameMatcher.matches(
        {
          depName: undefined,
        },
        {
          matchDepNames: ['@opentelemetry/http'],
        },
      );
      expect(result).toBeFalse();
    });
  });

  describe('exclude', () => {
    it('should return false if packageFile is not defined', () => {
      const result = depNameMatcher.excludes(
        {
          depName: undefined,
        },
        {
          excludeDepNames: ['@opentelemetry/http'],
        },
      );
      expect(result).toBeFalse();
    });
  });
});
