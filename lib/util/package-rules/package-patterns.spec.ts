import { PackagePatternsMatcher } from './package-patterns';

describe('util/package-rules/package-patterns', () => {
  const packagePatternsMatcher = new PackagePatternsMatcher();

  describe('match', () => {
    it('should return false if packageName is not defined', () => {
      const result = packagePatternsMatcher.matches(
        {
          packageName: undefined,
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
          packageName: 'def',
        },
        {
          matchPackagePatterns: ['def'],
        },
      );
      expect(result).toBeTrue();
    });
  });

  describe('exclude', () => {
    it('should exclude packageName', () => {
      const result = packagePatternsMatcher.excludes(
        {
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
