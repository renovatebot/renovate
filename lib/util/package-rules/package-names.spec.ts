import { PackageNameMatcher } from './package-names';

describe('util/package-rules/package-names', () => {
  const packageNameMatcher = new PackageNameMatcher();

  describe('match', () => {
    it('should return false if packageFile is not defined', () => {
      const result = packageNameMatcher.matches(
        {
          depName: undefined,
        },
        {
          matchPackageNames: ['@opentelemetry/http'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should matchPackageName', () => {
      const result = packageNameMatcher.matches(
        {
          depName: 'abc',
          packageName: 'def',
        },
        {
          matchPackageNames: ['def'],
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
          matchPackageNames: ['abc'],
        },
      );
      expect(result).toBeTrue();
    });
  });

  describe('exclude', () => {
    it('should return false if packageFile is not defined', () => {
      const result = packageNameMatcher.excludes(
        {
          depName: undefined,
        },
        {
          excludePackageNames: ['@opentelemetry/http'],
        },
      );
      expect(result).toBeFalse();
    });
  });
});
