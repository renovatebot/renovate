import { FilesMatcher } from './index';

describe('util/package-rules/files/index', () => {
  const fileMatcher = new FilesMatcher();

  describe('match', () => {
    it('should return false if packageFile is not defined', () => {
      const result = fileMatcher.matches(
        {
          packageFile: undefined,
        },
        {
          matchFiles: ['frontend/package.json'],
        }
      );
      expect(result).not.toBeNull();
      expect(result).toBeFalse();
    });
  });
});
