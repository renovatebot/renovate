import { FileNamesMatcher } from './files';

describe('util/package-rules/files', () => {
  const fileMatcher = new FileNamesMatcher();

  describe('match', () => {
    it('should return false if packageFile is not defined', () => {
      const result = fileMatcher.matches(
        {
          packageFile: undefined,
        },
        {
          matchFileNames: ['frontend/package.json'],
        },
      );
      expect(result).toBeFalse();
    });
  });
});
