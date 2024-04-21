import { PackagePrefixesMatcher } from './package-prefixes';

describe('util/package-rules/package-prefixes', () => {
  const packagePrefixesMatcher = new PackagePrefixesMatcher();

  describe('match', () => {
    it('should return false if packageName is not defined', () => {
      const result = packagePrefixesMatcher.matches(
        {
          packageName: undefined,
        },
        {
          matchPackagePrefixes: ['@opentelemetry'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should return true if packageName matched', () => {
      const result = packagePrefixesMatcher.matches(
        {
          packageName: 'def1',
        },
        {
          matchPackagePrefixes: ['def'],
        },
      );
      expect(result).toBeTrue();
    });
  });

  describe('exclude', () => {
    it('should return false if packageName is not defined', () => {
      const result = packagePrefixesMatcher.excludes(
        {
          packageName: undefined,
        },
        {
          excludePackagePrefixes: ['@opentelemetry'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should return true if packageName matched', () => {
      const result = packagePrefixesMatcher.excludes(
        {
          packageName: 'def1',
        },
        {
          excludePackagePrefixes: ['def'],
        },
      );
      expect(result).toBeTrue();
    });
  });
});
