import { PackagePatternsMatcher } from './package-patterns';

describe('util/package-rules/package-patterns', () => {
  const packageNameMatcher = new PackagePatternsMatcher();

  describe('match', () => {
    it('should return false if depName is not defined', () => {
      const result = packageNameMatcher.matches(
        {
          depName: undefined,
        },
        {
          matchPackagePatterns: ['@opentelemetry/http'],
        }
      );
      expect(result).toBeFalse();
    });
  });
});
