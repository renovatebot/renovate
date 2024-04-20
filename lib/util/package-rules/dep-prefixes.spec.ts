import { DepPrefixesMatcher } from './dep-prefixes';

describe('util/package-rules/dep-prefixes', () => {
  const depPrefixesMatcher = new DepPrefixesMatcher();

  describe('match', () => {
    it('should return null if matchDepPrefixes is not defined', () => {
      const result = depPrefixesMatcher.matches(
        {
          depName: 'abc1',
        },
        {
          matchDepPrefixes: undefined,
        },
      );
      expect(result).toBeNull();
    });

    it('should return false if depName is not defined', () => {
      const result = depPrefixesMatcher.matches(
        {
          depName: undefined,
        },
        {
          matchDepPrefixes: ['@opentelemetry'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should return true if depName matched', () => {
      const result = depPrefixesMatcher.matches(
        {
          depName: 'abc1',
        },
        {
          matchDepPrefixes: ['abc'],
        },
      );
      expect(result).toBeTrue();
    });

    it('should return false if depName does not match', () => {
      const result = depPrefixesMatcher.matches(
        {
          depName: 'abc1',
        },
        {
          matchDepPrefixes: ['def'],
        },
      );
      expect(result).toBeFalse();
    });
  });

  describe('exclude', () => {
    it('should return null if excludeDepPrefixes is not defined', () => {
      const result = depPrefixesMatcher.excludes(
        {
          depName: 'abc1',
        },
        {
          excludeDepPrefixes: undefined,
        },
      );
      expect(result).toBeNull();
    });

    it('should return false if depName is not defined', () => {
      const result = depPrefixesMatcher.excludes(
        {
          depName: undefined,
        },
        {
          excludeDepPrefixes: ['@opentelemetry'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should return true if depName matched', () => {
      const result = depPrefixesMatcher.excludes(
        {
          depName: 'abc1',
        },
        {
          excludeDepPrefixes: ['abc'],
        },
      );
      expect(result).toBeTrue();
    });

    it('should return false if depName does not match', () => {
      const result = depPrefixesMatcher.excludes(
        {
          depName: 'abc1',
        },
        {
          excludeDepPrefixes: ['def'],
        },
      );
      expect(result).toBeFalse();
    });
  });
});
