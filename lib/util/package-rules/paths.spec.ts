import { PathsMatcher } from './paths';

describe('util/package-rules/paths', () => {
  const pathsMatcher = new PathsMatcher();

  describe('match', () => {
    it('should return false if packageFile is not defined', () => {
      const result = pathsMatcher.matches(
        {
          packageFile: undefined,
        },
        {
          matchPaths: ['opentelemetry/http'],
        }
      );
      expect(result).toBeFalse();
    });
  });
});
