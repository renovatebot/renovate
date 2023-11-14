import aws from '.';

describe('modules/versioning/aws-machine-image/index', () => {
  describe('parse(version)', () => {
    it('should return 1.0.0', () => {
      expect(aws.getMajor('ami-00e1b2c30011d4e5f')).toBe(1);
      expect(aws.getMinor('ami-00e1b2c30011d4e5f')).toBe(0);
      expect(aws.getPatch('ami-00e1b2c30011d4e5f')).toBe(0);
    });
  });

  describe('isValid(version)', () => {
    it('should return true', () => {
      expect(aws.isValid('ami-00e1b2c30011d4e5f')).toBeTruthy();
    });

    it('should return false', () => {
      expect(aws.isValid('ami-1')).toBeFalsy();
    });
  });

  describe('isVersion(version)', () => {
    it('should return true', () => {
      expect(aws.isVersion('ami-00e1b2c30011d4e5f')).toBeTruthy();
    });

    it('should return false', () => {
      expect(aws.isVersion('ami-1')).toBeFalsy();
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
        aws.isCompatible('ami-00e1b2c30011d4e5f', 'anything'),
      ).toBeTruthy();
    });

    it('should return false', () => {
      expect(aws.isCompatible('ami-1', 'anything')).toBeFalsy();
    });
  });

  describe('isGreaterThan(version1, version2)', () => {
    it('should return true', () => {
      // Since we can't compare AMI IDs directly, we consider any version
      // greater than any other version so that updates will be generated.
      // https://github.com/renovatebot/renovate/discussions/13739
      expect(aws.isGreaterThan('ami-00', 'ami-99')).toBeTrue();
      expect(aws.isGreaterThan('ami-99', 'ami-00')).toBeTrue();
    });
  });
});
