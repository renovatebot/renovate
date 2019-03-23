const semver = require('../../lib/versioning/hex');

describe('lib/versioning/hex', () => {
  describe('semver.matches()', () => {
    it('handles tilde greater than', () => {
      expect(semver.matches('4.2.0', '~> 4.0')).toBeTruthy();
      expect(semver.matches('2.1.0', '~> 2.0.0')).toBeFalsy();
      expect(semver.matches('2.0.0', '>= 2.0.0 and < 2.1.0')).toBeTruthy();
      expect(semver.matches('2.1.0', '== 2.0.0 or < 2.1.0')).toBeFalsy();
    });
  });
  it('handles tilde greater than', () => {
    expect(
      semver.maxSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '~> 4.0'
      )
    ).toBe('4.2.0');
    expect(
      semver.maxSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '~> 4.0.0'
      )
    ).toBe('4.0.0');
  });
  describe('semver.isValid()', () => {
    it('handles and', () => {
      expect(semver.isValid('>= 1.0.0 and <= 2.0.0')).toBeTruthy();
    });
    it('handles or', () => {
      expect(semver.isValid('>= 1.0.0 or <= 2.0.0')).toBeTruthy();
    });
    it('handles !=', () => {
      expect(semver.isValid('!= 1.0.0')).toBeTruthy();
    });
  });
  describe('semver.isLessThanRange()', () => {
    it('handles and', () => {
      expect(
        semver.isLessThanRange('0.1.0', '>= 1.0.0 and <= 2.0.0')
      ).toBeTruthy();
      expect(
        semver.isLessThanRange('1.9.0', '>= 1.0.0 and <= 2.0.0')
      ).toBeFalsy();
    });
    it('handles or', () => {
      expect(
        semver.isLessThanRange('0.9.0', '>= 1.0.0 or >= 2.0.0')
      ).toBeTruthy();
      expect(
        semver.isLessThanRange('1.9.0', '>= 1.0.0 or >= 2.0.0')
      ).toBeFalsy();
    });
  });
  describe('semver.minSatisfyingVersion()', () => {
    it('handles tilde greater than', () => {
      expect(
        semver.minSatisfyingVersion(
          ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
          '~> 4.0'
        )
      ).toBe('4.2.0');
      expect(
        semver.minSatisfyingVersion(
          ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
          '~> 4.0.0'
        )
      ).toBeNull();
    });
  });
  describe('semver.getNewValue()', () => {
    it('handles tilde greater than', () => {
      expect(semver.getNewValue('~> 1.2', 'replace', '1.2.3', '2.0.7')).toEqual(
        '~> 2.0'
      );
      expect(semver.getNewValue('~> 1.2', 'pin', '1.2.3', '2.0.7')).toEqual(
        '2.0.7'
      );
      expect(semver.getNewValue('~> 1.2', 'bump', '1.2.3', '2.0.7')).toEqual(
        '~> 2'
      );
      expect(
        semver.getNewValue('~> 1.2.0', 'replace', '1.2.3', '2.0.7')
      ).toEqual('~> 2.0.0');
      expect(semver.getNewValue('~> 1.2.0', 'pin', '1.2.3', '2.0.7')).toEqual(
        '2.0.7'
      );
      expect(semver.getNewValue('~> 1.2.0', 'bump', '1.2.3', '2.0.7')).toEqual(
        '~> 2.0.7'
      );
    });
  });
  it('handles and', () => {
    expect(
      semver.getNewValue('>= 1.0.0 and <= 2.0.0', 'widen', '1.2.3', '2.0.7')
    ).toEqual('>= 1.0.0 and <= 2.0.7');
    expect(
      semver.getNewValue('>= 1.0.0 and <= 2.0.0', 'replace', '1.2.3', '2.0.7')
    ).toEqual('<= 2.0.7');
    expect(
      semver.getNewValue('>= 1.0.0 and <= 2.0.0', 'pin', '1.2.3', '2.0.7')
    ).toEqual('2.0.7');
  });
  it('handles or', () => {
    expect(
      semver.getNewValue('>= 1.0.0 or <= 2.0.0', 'widen', '1.2.3', '2.0.7')
    ).toEqual('>= 1.0.0 or <= 2.0.7');
    expect(
      semver.getNewValue('>= 1.0.0 or <= 2.0.0', 'replace', '1.2.3', '2.0.7')
    ).toEqual('<= 2.0.7');
    expect(
      semver.getNewValue('>= 1.0.0 or <= 2.0.0', 'pin', '1.2.3', '2.0.7')
    ).toEqual('2.0.7');
  });
});
