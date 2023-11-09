import semverCoerced from '.';

describe('modules/versioning/semver-coerced/index', () => {
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

    it('invalid version', () => {
      expect(semverCoerced.equals('xxx', '1.2.3')).toBeFalse();
    });
  });

  describe('.getMajor(input)', () => {
    it('should return major version number for strict semver', () => {
      expect(semverCoerced.getMajor('1.0.2')).toBe(1);
    });

    it('should return major version number for non-strict semver', () => {
      expect(semverCoerced.getMajor('v3.1')).toBe(3);
    });

    it('invalid version', () => {
      expect(semverCoerced.getMajor('xxx')).toBeNull();
    });
  });

  describe('.getMinor(input)', () => {
    it('should return minor version number for strict semver', () => {
      expect(semverCoerced.getMinor('1.0.2')).toBe(0);
    });

    it('should return minor version number for non-strict semver', () => {
      expect(semverCoerced.getMinor('v3.1')).toBe(1);
    });

    it('invalid version', () => {
      expect(semverCoerced.getMinor('xxx')).toBeNull();
    });
  });

  describe('.getPatch(input)', () => {
    it.each`
      version           | expected
      ${'1.0.2'}        | ${2}
      ${'v3.1.2-foo'}   | ${2}
      ${'v1.3.5'}       | ${5}
      ${'v2.1'}         | ${0}
      ${'3.4'}          | ${0}
      ${'v2'}           | ${0}
      ${'2'}            | ${0}
      ${'v1.0.4-alpha'} | ${4}
      ${'1.0.3-Beta.1'} | ${3}
      ${'1.0.0-rc2'}    | ${0}
      ${'v1.0.8-rc2'}   | ${8}
      ${'1.0-Beta.0'}   | ${0}
      ${'two1.0'}       | ${0}
      ${'ver1.2.3'}     | ${3}
      ${'r3.0'}         | ${0}
      ${'abc'}          | ${null}
    `('getPatch("$version") === $expected', ({ version, expected }) => {
      expect(semverCoerced.getPatch(version)).toBe(expected);
    });
  });

  describe('.isCompatible(input)', () => {
    it('should return true for strict semver', () => {
      expect(semverCoerced.isCompatible('1.0.2')).toBeTrue();
    });

    it('should return true for non-strict semver', () => {
      expect(semverCoerced.isCompatible('v3.1.2-foo')).toBeTrue();
    });

    it('should return false for non-semver', () => {
      expect(semverCoerced.isCompatible('foo')).toBeFalse();
    });
  });

  describe('.isGreaterThan(a, b)', () => {
    it('should return true for a greater version in strict semver', () => {
      expect(semverCoerced.isGreaterThan('1.0.2', '1.0.0')).toBeTrue();
    });

    it('should return false for lower version in strict semver', () => {
      expect(semverCoerced.isGreaterThan('3.1.2', '4.1.0')).toBeFalse();
    });

    it('should return false if version cannot be coerced', () => {
      expect(semverCoerced.isGreaterThan('e.e.e', '4.1.0')).toBeFalse();
    });
  });

  describe('.isLessThanRange(version, range)', () => {
    it('should return true for a lower version in strict semver', () => {
      expect(semverCoerced.isLessThanRange?.('1.0.2', '~2.0')).toBeTrue();
    });

    it('should return false for in-range version in strict semver', () => {
      expect(semverCoerced.isLessThanRange?.('3.0.2', '~3.0')).toBeFalse();
    });

    it('invalid version', () => {
      expect(semverCoerced.isLessThanRange?.('xxx', '1.2.3')).toBeFalse();
    });
  });

  describe('.isSingleVersion()', () => {
    it('returns true if naked version', () => {
      expect(semverCoerced.isSingleVersion('1.2.3')).toBeTrue();
      expect(semverCoerced.isSingleVersion('1.2.3-alpha.1')).toBeTrue();
    });

    it('returns false if equals', () => {
      expect(semverCoerced.isSingleVersion('=1.2.3')).toBeFalse();
      expect(semverCoerced.isSingleVersion('= 1.2.3')).toBeFalse();
    });

    it('returns false when not version', () => {
      expect(semverCoerced.isSingleVersion('~1.0')).toBeFalse();
    });
  });

  describe('.isStable(input)', () => {
    it.each`
      version           | expected
      ${'1.0.0'}        | ${true}
      ${'v1.3.5'}       | ${true}
      ${'v2.1'}         | ${true}
      ${'3.4'}          | ${true}
      ${'v2'}           | ${true}
      ${'2'}            | ${true}
      ${'v1.0.0-alpha'} | ${false}
      ${'1.0.0-Beta.1'} | ${false}
      ${'1.0.0-rc2'}    | ${false}
      ${'v1.0.0-rc2'}   | ${false}
      ${'1.0-Beta.0'}   | ${false}
      ${'v1.0-alpha'}   | ${false}
      ${'two1.0'}       | ${false}
      ${'ver1.2.3'}     | ${false}
      ${'r3.0'}         | ${false}
    `('isStable("$version") === $expected', ({ version, expected }) => {
      expect(semverCoerced.isStable(version)).toBe(expected);
    });
  });

  describe('.isValid(input)', () => {
    it('should return null for non-digit version strings', () => {
      expect(semverCoerced.isValid('version two')).toBeFalse();
    });

    it('should return null for irregular version strings', () => {
      expect(semverCoerced.isValid('17.04.0')).toBeFalse();
    });

    it('should support strict semver', () => {
      expect(semverCoerced.isValid('1.2.3')).toBeTrue();
    });

    it('should treat semver with dash as a valid version', () => {
      expect(semverCoerced.isValid('1.2.3-foo')).toBeTrue();
    });

    it('should treat semver without dash as a valid version', () => {
      expect(semverCoerced.isValid('1.2.3foo')).toBeTrue();
    });

    it('should treat ranges as valid versions', () => {
      expect(semverCoerced.isValid('~1.2.3')).toBeTrue();
      expect(semverCoerced.isValid('^1.2.3')).toBeTrue();
      expect(semverCoerced.isValid('>1.2.3')).toBeTrue();
    });

    it('should reject github repositories', () => {
      expect(semverCoerced.isValid('renovatebot/renovate')).toBeFalse();
      expect(semverCoerced.isValid('renovatebot/renovate#master')).toBeFalse();
      expect(
        semverCoerced.isValid('https://github.com/renovatebot/renovate.git'),
      ).toBeFalse();
    });
  });

  describe('.isVersion(input)', () => {
    it('should return null for non-digit versions', () => {
      expect(semverCoerced.isValid('version one')).toBeFalse();
    });

    it('should support strict semver versions', () => {
      expect(semverCoerced.isValid('1.2.3')).toBeTrue();
    });

    it('should support non-strict versions', () => {
      expect(semverCoerced.isValid('v1.2')).toBeTrue();
    });
  });

  describe('.matches(version, range)', () => {
    it('should return true when version is in range', () => {
      expect(semverCoerced.matches('1.0.0', '1.0.0 || 1.0.1')).toBeTrue();
    });

    it('should return true with non-strict version in range', () => {
      expect(semverCoerced.matches('v1.0', '1.0.0 || 1.0.1')).toBeTrue();
    });

    it('should return false when version is not in range', () => {
      expect(semverCoerced.matches('1.2.3', '1.4.1 || 1.4.2')).toBeFalse();
    });

    it('invalid version', () => {
      expect(semverCoerced.matches('xxx', '1.2.3')).toBe(false);
    });
  });

  describe('.getSatisfyingVersion(versions, range)', () => {
    it('should return max satisfying version in range', () => {
      expect(
        semverCoerced.getSatisfyingVersion(['1.0.0', '1.0.4'], '^1.0'),
      ).toBe('1.0.4');
    });

    it('should support coercion', () => {
      expect(
        semverCoerced.getSatisfyingVersion(['v1.0', '1.0.4-foo'], '^1.0'),
      ).toBe('1.0.4');
    });
  });

  describe('.minSatisfyingVersion(versions, range)', () => {
    it('should return min satisfying version in range', () => {
      expect(
        semverCoerced.minSatisfyingVersion(['1.0.0', '1.0.4'], '^1.0'),
      ).toBe('1.0.0');
    });

    it('should support coercion', () => {
      expect(
        semverCoerced.minSatisfyingVersion(['v1.0', '1.0.4-foo'], '^1.0'),
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
        }),
      ).toBe('1.1.0');
    });
  });

  describe('.sortVersions(a, b)', () => {
    it('should return zero for equal versions', () => {
      expect(semverCoerced.sortVersions('1.0.0', '1.0.0')).toBe(0);
    });

    it('should return -1 for a < b', () => {
      expect(semverCoerced.sortVersions('1.0.0', '1.0.1')).toBe(-1);
    });

    it('should return 1 for a > b', () => {
      expect(semverCoerced.sortVersions('1.0.1', '1.0.0')).toBe(1);
    });

    it('should return zero for equal non-strict versions', () => {
      expect(semverCoerced.sortVersions('v1.0', '1.x')).toBe(0);
    });

    it('works with invalid version', () => {
      expect(semverCoerced.sortVersions('v1.0', 'xx')).toBe(0);
    });
  });
});
