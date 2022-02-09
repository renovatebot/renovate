import semverCoerced from '.';

describe('versioning/semver-coerced/index', () => {
  describe('.equals(a, b)', () => {
    it('should return true for strictly equal versions', () => {
      expect(semverCoerced.equals('1.0.0', '1.0.0')).toBeTrue();
    });

    it('should return true for non-strictly equal versions', () => {
      expect(semverCoerced.equals('v1.0', '1.0.0')).toBeTrue();
      expect(semverCoerced.equals('v1.0', 'v1.x')).toBeTrue();
    });

    it('should return false for non-equal versions', () => {
      expect(semverCoerced.equals('2.0.1', '2.3.0')).toBeFalse();
    });
  });

  describe('.getMajor(input)', () => {
    it('should return major version number for strict semver', () => {
      expect(semverCoerced.getMajor('1.0.2')).toBe(1);
    });

    it('should return major version number for non-strict semver', () => {
      expect(semverCoerced.getMajor('v3.1')).toBe(3);
    });
  });

  describe('.getMinor(input)', () => {
    it('should return minor version number for strict semver', () => {
      expect(semverCoerced.getMinor('1.0.2')).toBe(0);
    });

    it('should return minor version number for non-strict semver', () => {
      expect(semverCoerced.getMinor('v3.1')).toBe(1);
    });
  });

  describe('.getPatch(input)', () => {
    it('should return patch version number for strict semver', () => {
      expect(semverCoerced.getPatch('1.0.2')).toBe(2);
    });

    it('should return patch version number for non-strict semver', () => {
      expect(semverCoerced.getPatch('v3.1.2-foo')).toBe(2);
    });
  });

  describe('.isCompatible(input)', () => {
    it('should return true for strict semver', () => {
      expect(semverCoerced.isCompatible('1.0.2')).toBeTruthy();
    });

    it('should return true for non-strict semver', () => {
      expect(semverCoerced.isCompatible('v3.1.2-foo')).toBeTruthy();
    });

    it('should return false for non-semver', () => {
      expect(semverCoerced.isCompatible('foo')).toBeFalsy();
    });
  });

  describe('.isGreaterThan(a, b)', () => {
    it('should return true for a greater version in strict semver', () => {
      expect(semverCoerced.isGreaterThan('1.0.2', '1.0.0')).toBeTruthy();
    });

    it('should return false for lower version in strict semver', () => {
      expect(semverCoerced.isGreaterThan('3.1.2', '4.1.0')).toBeFalsy();
    });

    it('should return false if version cannot be coerced', () => {
      expect(semverCoerced.isGreaterThan('e.e.e', '4.1.0')).toBeFalsy();
    });
  });

  describe('.isLessThanRange(version, range)', () => {
    it('should return true for a lower version in strict semver', () => {
      expect(semverCoerced.isLessThanRange?.('1.0.2', '~2.0')).toBeTruthy();
    });

    it('should return false for in-range version in strict semver', () => {
      expect(semverCoerced.isLessThanRange?.('3.0.2', '~3.0')).toBeFalsy();
    });
  });

  describe('.isSingleVersion()', () => {
    it('returns true if naked version', () => {
      expect(semverCoerced.isSingleVersion('1.2.3')).toBeTruthy();
      expect(semverCoerced.isSingleVersion('1.2.3-alpha.1')).toBeTruthy();
    });

    it('returns false if equals', () => {
      expect(semverCoerced.isSingleVersion('=1.2.3')).toBeFalsy();
      expect(semverCoerced.isSingleVersion('= 1.2.3')).toBeFalsy();
    });

    it('returns false when not version', () => {
      expect(semverCoerced.isSingleVersion('~1.0')).toBeFalsy();
    });
  });

  describe('.isStable(input)', () => {
    it('should return true for a stable version', () => {
      expect(semverCoerced.isStable('1.0.0')).toBeTruthy();
    });

    it('should return false for an prerelease version', () => {
      expect(semverCoerced.isStable('v1.0-alpha')).toBeFalsy();
    });
  });

  describe('.isValid(input)', () => {
    it('should return null for non-digit version strings', () => {
      expect(semverCoerced.isValid('version two')).toBeFalsy();
    });

    it('should return null for irregular version strings', () => {
      expect(semverCoerced.isValid('17.04.0')).toBeFalsy();
    });

    it('should support strict semver', () => {
      expect(semverCoerced.isValid('1.2.3')).toBeTruthy();
    });

    it('should treat semver with dash as a valid version', () => {
      expect(semverCoerced.isValid('1.2.3-foo')).toBeTruthy();
    });

    it('should treat semver without dash as a valid version', () => {
      expect(semverCoerced.isValid('1.2.3foo')).toBeTruthy();
    });

    it('should treat ranges as valid versions', () => {
      expect(semverCoerced.isValid('~1.2.3')).toBeTruthy();
      expect(semverCoerced.isValid('^1.2.3')).toBeTruthy();
      expect(semverCoerced.isValid('>1.2.3')).toBeTruthy();
    });

    it('should reject github repositories', () => {
      expect(semverCoerced.isValid('renovatebot/renovate')).toBeFalsy();
      expect(semverCoerced.isValid('renovatebot/renovate#master')).toBeFalsy();
      expect(
        semverCoerced.isValid('https://github.com/renovatebot/renovate.git')
      ).toBeFalsy();
    });
  });

  describe('.isVersion(input)', () => {
    it('should return null for non-digit versions', () => {
      expect(semverCoerced.isValid('version one')).toBeFalsy();
    });

    it('should support strict semver versions', () => {
      expect(semverCoerced.isValid('1.2.3')).toBeTruthy();
    });

    it('should support non-strict versions', () => {
      expect(semverCoerced.isValid('v1.2')).toBeTruthy();
    });
  });

  describe('.matches(version, range)', () => {
    it('should return true when version is in range', () => {
      expect(semverCoerced.matches('1.0.0', '1.0.0 || 1.0.1')).toBeTruthy();
    });

    it('should return true with non-strict version in range', () => {
      expect(semverCoerced.matches('v1.0', '1.0.0 || 1.0.1')).toBeTruthy();
    });

    it('should return false when version is not in range', () => {
      expect(semverCoerced.matches('1.2.3', '1.4.1 || 1.4.2')).toBeFalsy();
    });
  });

  describe('.getSatisfyingVersion(versions, range)', () => {
    it('should return max satisfying version in range', () => {
      expect(
        semverCoerced.getSatisfyingVersion(['1.0.0', '1.0.4'], '^1.0')
      ).toBe('1.0.4');
    });

    it('should support coercion', () => {
      expect(
        semverCoerced.getSatisfyingVersion(['v1.0', '1.0.4-foo'], '^1.0')
      ).toBe('1.0.4');
    });
  });

  describe('.minSatisfyingVersion(versions, range)', () => {
    it('should return min satisfying version in range', () => {
      expect(
        semverCoerced.minSatisfyingVersion(['1.0.0', '1.0.4'], '^1.0')
      ).toBe('1.0.0');
    });

    it('should support coercion', () => {
      expect(
        semverCoerced.minSatisfyingVersion(['v1.0', '1.0.4-foo'], '^1.0')
      ).toBe('1.0.0');
    });
  });

  describe('getNewValue()', () => {
    it('uses newVersion', () => {
      expect(
        semverCoerced.getNewValue({
          currentValue: '=1.0.0',
          rangeStrategy: 'bump',
          currentVersion: '1.0.0',
          newVersion: '1.1.0',
        })
      ).toBe('1.1.0');
    });
  });

  describe('.sortVersions(a, b)', () => {
    it('should return zero for equal versions', () => {
      expect(semverCoerced.sortVersions('1.0.0', '1.0.0')).toBe(0);
    });

    it('should return -1 for a < b', () => {
      expect(semverCoerced.sortVersions('1.0.0', '1.0.1')).toEqual(-1);
    });

    it('should return 1 for a > b', () => {
      expect(semverCoerced.sortVersions('1.0.1', '1.0.0')).toBe(1);
    });

    it('should return zero for equal non-strict versions', () => {
      expect(semverCoerced.sortVersions('v1.0', '1.x')).toBe(0);
    });
  });
});
