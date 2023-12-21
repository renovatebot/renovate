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
        },
      );
      expect(result).toBeFalse();
    });

    it('should return true if packageName matched', () => {
      const result = packagePrefixesMatcher.matches(
        {
          depName: 'abc1',
          packageName: 'def1',
        },
        {
          matchPackagePrefixes: ['def'],
        },
      );
      expect(result).toBeTrue();
    });

    it('should return true but warn if depName matched', () => {
      const result = packagePrefixesMatcher.matches(
        {
          depName: 'abc1',
          packageName: 'def1',
        },
        {
          matchPackagePrefixes: ['abc'],
        },
      );
      expect(result).toBeTrue();
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
        },
      );
      expect(result).toBeFalse();
    });
  });
});
