import { DepPrefixesMatcher } from './dep-prefixes';

describe('util/package-rules/dep-prefixes', () => {
  const depPrefixesMatcher = new DepPrefixesMatcher();

  describe('match', () => {
    it('should return false if depName is not defined', () => {
      const result = depPrefixesMatcher.matches(
        {
          depName: undefined,
        },
        {
          matchDepPrefixes: ['@opentelemetry'],
        }
      );
      expect(result).toBeFalse();
    });
  });

  describe('exclude', () => {
    it('should return false if depName is not defined', () => {
      const result = depPrefixesMatcher.excludes(
        {
          depName: undefined,
        },
        {
          excludeDepPrefixes: ['@opentelemetry'],
        }
      );
      expect(result).toBeFalse();
    });
  });
});
