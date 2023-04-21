import { FilesMatcher } from './files';

describe('util/package-rules/files', () => {
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
      expect(result).toBeFalse();
    });
  });
});
