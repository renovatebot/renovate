import aws from '.';

describe('versioning/aws-machine-image/index', () => {
  describe('isValid(version)', () => {
    it('should return true', () => {
      expect(aws.isValid('ami-00e1b2c30011d4e5f')).toBeTruthy();
    });
    it('should return false', () => {
      expect(aws.isValid('ami-1')).toBeFalsy();
    });
  });
  describe('isCompatible(version)', () => {
    it('should return true', () => {
      expect(aws.isCompatible('ami-00e1b2c30011d4e5f')).toBeTruthy();
    });
    it('should return false', () => {
      expect(aws.isCompatible('ami-1')).toBeFalsy();
    });
  });
  describe('isCompatible(version,range)', () => {
    it('should return true', () => {
      expect(
        aws.isCompatible('ami-00e1b2c30011d4e5f', 'anything')
      ).toBeTruthy();
    });
    it('should return false', () => {
      expect(aws.isCompatible('ami-1', 'anything')).toBeFalsy();
    });
  });
  describe('isGreaterThan(version1, version2)', () => {
    it('should return false', () => {
      expect(aws.isGreaterThan('', '')).toBeTruthy();
    });
  });
});
