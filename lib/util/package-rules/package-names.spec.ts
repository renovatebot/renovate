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
        }
      );
      expect(result).toBeFalse();
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
        }
      );
      expect(result).toBeFalse();
    });
  });
});
