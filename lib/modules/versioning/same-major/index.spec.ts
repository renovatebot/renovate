import sameMajor from '.';

describe('modules/versioning/same-major/index', () => {
  describe('.matches(version, range)', () => {
    it('should return true when version is has same major', () => {
      expect(sameMajor.matches('1.0.1', '1.0.0')).toBeTrue();
    });

    it('should return false when version has different major', () => {
      expect(sameMajor.matches('2.0.1', '1.0.0')).toBeFalse();
    });

    it('should return false when version is lesser than the current version', () => {
      expect(sameMajor.matches('1.2.3', '1.2.4')).toBeFalse();
    });
  });

  describe('.getSatisfyingVersion(versions, range)', () => {
    it('should return max satisfying version in range', () => {
      expect(
        sameMajor.getSatisfyingVersion(
          ['1.0.0', '1.0.4', '1.3.0', '2.0.0'],
          '1.0.3',
        ),
      ).toBe('1.3.0');
    });
  });

  describe('.minSatisfyingVersion(versions, range)', () => {
    it('should return min satisfying version in range', () => {
      expect(
        sameMajor.minSatisfyingVersion(
          ['1.0.0', '1.0.4', '1.3.0', '2.0.0'],
          '1.0.3',
        ),
      ).toBe('1.0.4');
    });
  });

  describe('.isLessThanRange(version, range)', () => {
    it('should return true', () => {
      expect(sameMajor.isLessThanRange?.('2.0.2', '3.0.0')).toBeTrue();
    });

    it('should return false', () => {
      expect(sameMajor.isLessThanRange?.('4.0.0', '3.0.0')).toBeFalse();
      expect(sameMajor.isLessThanRange?.('3.1.0', '3.0.0')).toBeFalse();
    });
  });
});
