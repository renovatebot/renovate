import { PackageNameMatcher } from './package-names';

describe('util/package-rules/package-names', () => {
  const packageNameMatcher = new PackageNameMatcher();

  describe('match', () => {
    it('should return false if packageName is not defined', () => {
      const result = packageNameMatcher.matches(
        {
          packageName: undefined,
        },
        {
          matchPackageNames: ['@opentelemetry/http'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should return false if not matching', () => {
      const result = packageNameMatcher.matches(
        {
          depName: 'abc',
          packageName: 'def',
        },
        {
          matchPackageNames: ['ghi'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should matchPackageName', () => {
      const result = packageNameMatcher.matches(
        {
          packageName: 'def',
        },
        {
          matchPackageNames: ['def', 'ghi'],
        },
      );
      expect(result).toBeTrue();
    });

    it('should match pattern', () => {
      const result = packageNameMatcher.matches(
        {
          packageName: 'b',
        },
        {
          matchPackageNames: ['/b/'],
        },
      );
      expect(result).toBeTrue();
    });
  });
});
