import { logger } from '../../../test/util';
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
          depName: 'abc',
          packageName: 'def',
        },
        {
          matchPackageNames: ['def', 'ghi'],
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
          matchPackageNames: ['ghi', 'abc'],
        },
      );
      expect(result).toBeTrue();
      expect(logger.logger.once.info).toHaveBeenCalled();
    });
  });

  describe('exclude', () => {
    it('should return false if packageName is not defined', () => {
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

    it('should return false if not matching', () => {
      const result = packageNameMatcher.excludes(
        {
          depName: 'abc',
          packageName: 'def',
        },
        {
          excludePackageNames: ['ghi'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should excludePackageName', () => {
      const result = packageNameMatcher.excludes(
        {
          depName: 'abc',
          packageName: 'def',
        },
        {
          excludePackageNames: ['def', 'ghi'],
        },
      );
      expect(result).toBeTrue();
    });

    it('should fall back to depName excludePackageName', () => {
      const result = packageNameMatcher.excludes(
        {
          depName: 'abc',
          packageName: 'def',
        },
        {
          excludePackageNames: ['abc', 'ghi'],
        },
      );
      expect(result).toBeTrue();
      expect(logger.logger.once.info).toHaveBeenCalled();
    });
  });
});
