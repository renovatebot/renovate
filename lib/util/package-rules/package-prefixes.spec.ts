import { PackagePrefixesMatcher } from './package-prefixes';

describe('util/package-rules/package-prefixes', () => {
  const packagePrefixesMatcher = new PackagePrefixesMatcher();

  describe('match', () => {
    it('should return false if depName is not defined', () => {
      const result = packagePrefixesMatcher.matches(
        {
          depName: undefined,
        },
        {
          matchPackagePrefixes: ['@opentelemetry'],
        }
      );
      expect(result).toBeFalse();
    });
  });

  describe('exclude', () => {
    it('should return false if depName is not defined', () => {
      const result = packagePrefixesMatcher.excludes(
        {
          depName: undefined,
        },
        {
          excludePackagePrefixes: ['@opentelemetry'],
        }
      );
      expect(result).toBeFalse();
    });
  });
});
