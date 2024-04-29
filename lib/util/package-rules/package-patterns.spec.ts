import { PackagePatternsMatcher } from './package-patterns';

describe('util/package-rules/package-patterns', () => {
  const packagePatternsMatcher = new PackagePatternsMatcher();

  describe('match', () => {
    it('should return false if depName is not defined', () => {
      const result = packagePatternsMatcher.matches(
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
      const result = packagePatternsMatcher.matches(
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
      const result = packagePatternsMatcher.matches(
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

  describe('exclude', () => {
    it('should exclude packageName', () => {
      const result = packagePatternsMatcher.excludes(
        {
          depName: 'abc',
          packageName: 'def',
        },
        {
          excludePackagePatterns: ['def'],
        },
      );
      expect(result).toBeTrue();
    });
  });
});
