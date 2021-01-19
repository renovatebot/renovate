import git from '.';

describe('git.', () => {
  describe('isValid(version)', () => {
    it('should return true', () => {
      expect(git.isValid('a1')).toBeTruthy();
    });
  });
  describe('isCompatible(version)', () => {
    it('should return true', () => {
      expect(git.isCompatible('')).toBeTruthy();
    });
  });
  describe('isGreaterThan(version1, version2)', () => {
    it('should return false', () => {
      expect(git.isGreaterThan('', '')).toBeFalsy();
    });
  });
  describe('valueToVersion(version)', () => {
    it('should return same as input', () => {
      expect(git.valueToVersion('')).toEqual('');
    });
  });
});
