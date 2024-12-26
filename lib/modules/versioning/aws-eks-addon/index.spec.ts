import aws from '.';

describe('modules/versioning/aws-eks-addon/index', () => {
  describe('parse(version)', () => {
    it('should return 1.23.7 and release version', () => {
      expect(aws.getMajor('v1.20.7-eksbuild.1')).toBe(1);
      expect(aws.getMinor('v1.23.7-eksbuild.1')).toBe(23);
      expect(aws.getPatch('v1.20.7-eksbuild.1')).toBe(7);
    });
  });

  describe('isValid(version)', () => {
    it('should return true', () => {
      expect(aws.isValid('v1.11.7-eksbuild.23')).toBeTruthy();
    });

    it('should return false', () => {
      expect(aws.isValid('v1.11.7-noneksbuild.23')).toBeFalsy();
    });
  });

  describe('isVersion(version)', () => {
    it('should return true', () => {
      expect(aws.isVersion('v1.11.7-eksbuild.1')).toBeTruthy();
    });

    it('should return false', () => {
      expect(aws.isVersion('v1.11.7')).toBeFalsy();
    });
  });

  describe('isCompatible(version)', () => {
    it('should return false', () => {
      expect(aws.isCompatible('v1.11.7')).toBeFalsy();
      expect(aws.isCompatible('v1.11.7-noneksbuild')).toBeFalsy();
      expect(aws.isCompatible('v1.11.7-noneksbuild.1')).toBeFalsy();
      expect(aws.isCompatible('v1.11.7-eksbuild')).toBeFalsy();
    });
  });

  describe('isCompatible(version,range)', () => {
    it('should return true', () => {
      expect(
        aws.isCompatible('v1.11.7-eksbuild.1', 'v1.2.7-eksbuild.1'),
      ).toBeTruthy();
    });

    it('should return false', () => {
      expect(
        aws.isCompatible('v1.11.7-eksbuild.1', 'v1.11.7-noneksbuild.1'),
      ).toBeFalsy();
    });
  });

  describe('isGreaterThan(version1, version2)', () => {
    it('should return true', () => {
      expect(
        aws.isGreaterThan('v1.11.7-eksbuild.1', 'v1.11.7-eksbuild.0'),
      ).toBeTrue();
      expect(
        aws.isGreaterThan('v1.20.7-eksbuild.2', 'v1.20.7-eksbuild.1'),
      ).toBeTrue();
      expect(
        aws.isGreaterThan('v1.22.7-eksbuild.2', 'v1.20.7-eksbuild.1'),
      ).toBeTrue();
    });

    it('should return false', () => {
      expect(
        aws.isGreaterThan('v1.20.7-eksbuild.1', 'v1.20.7-eksbuild.2'),
      ).toBeFalsy();
      expect(
        aws.isGreaterThan('v1.20.7-eksbuild.1', 'v2.0.0-eksbuild.1'),
      ).toBeFalsy();
    });
  });

  it('getSatisfyingVersion', () => {
    expect(
      aws.getSatisfyingVersion(['v1.20.7-eksbuild.1'], 'v1.20.7-eksbuild.1'),
    ).toBe('v1.20.7-eksbuild.1');
    expect(
      aws.getSatisfyingVersion(
        ['v1.20.7-eksbuild.1', 'v1.20.7-eksbuild.2', 'v1.20.7-eksbuild.7'],
        'v1.20.7-eksbuild.3',
      ),
    ).toBeNull();
    expect(
      aws.getSatisfyingVersion(
        ['v1.20.7-eksbuild.1', 'v1.20.7-eksbuild.2'],
        'v1.20.7-eksbuild.3',
      ),
    ).toBeNull();
  });
});
