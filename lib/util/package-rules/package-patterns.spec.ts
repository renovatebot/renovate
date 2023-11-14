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
        },
      );
      expect(result).toBeFalse();
    });

    it('should match packageName', () => {
      const result = packageNameMatcher.matches(
        {
          depName: 'abc',
          packageName: 'def',
        },
        {
          matchPackagePatterns: ['def'],
        },
      );
      expect(result).toBeTrue();
    });

    it('should fall back to matching depName', () => {
      const result = packageNameMatcher.matches(
        {
          depName: 'abc',
          packageName: 'def',
        },
        {
          matchPackagePatterns: ['abc'],
        },
      );
      expect(result).toBeTrue();
    });
  });
});
