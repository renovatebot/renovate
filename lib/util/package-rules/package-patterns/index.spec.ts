import { PackagePatternsMatcher } from './index';

describe('util/package-rules/package-patterns/index', () => {
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
      expect(result).not.toBeNull();
      expect(result).toBeFalse();
    });
  });
});
