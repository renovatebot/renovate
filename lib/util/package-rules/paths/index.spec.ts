import { PathsMatcher } from './index';

describe('util/package-rules/paths/index', () => {
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
      expect(result).not.toBeNull();
      expect(result).toBeFalse();
    });
  });
});
