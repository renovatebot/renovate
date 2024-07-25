import { DepNameMatcher } from './dep-names';

describe('util/package-rules/dep-names', () => {
  const depNameMatcher = new DepNameMatcher();

  describe('match', () => {
    it('should return false if packageFile is not defined', () => {
      const result = depNameMatcher.matches(
        {
          depName: undefined,
        },
        {
          matchDepNames: ['@opentelemetry/http'],
        },
      );
      expect(result).toBeFalse();
    });
  });
});
