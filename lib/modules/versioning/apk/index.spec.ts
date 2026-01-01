import apk from '.';

describe('modules/versioning/apk/index', () => {
  describe('isValid', () => {
    it.each`
      version               | expected
      ${'2.39.0-r0'}        | ${true}
      ${'2.39.0'}           | ${true}
      ${'2.39.0_rc1'}       | ${true}
      ${'foo'}              | ${false}
      ${'a.39.0-'}          | ${false}
      ${'6.5_p20250503-r0'} | ${true}
    `('isValid($version) === $expected', ({ version, expected }) => {
      expect(apk.isValid(version)).toBe(expected);
    });
  });

  describe('isStable', () => {
    it.each`
      version               | expected
      ${'2.39.0-r0'}        | ${true}
      ${'2.39.0_rc1-r0'}    | ${false}
      ${'2.39.0'}           | ${true}
      ${'2.39.0-r0'}        | ${true}
      ${'2.39.0_rc2'}       | ${false}
      ${'2.39.0_rc10-r0'}   | ${false}
      ${'2.39.0_rc1'}       | ${false}
      ${'2.39.0_rc0'}       | ${false}
      ${'6.5_p20250503-r0'} | ${true}
      ${'1.0_p1-r0'}        | ${true}
      ${'2.0_cvs-r0'}       | ${true}
      ${'3.0_git-r0'}       | ${true}
      ${'4.0_alpha-r0'}     | ${false}
      ${'5.0_beta-r0'}      | ${false}
    `('isStable($version) === $expected', ({ version, expected }) => {
      expect(apk.isStable(version)).toBe(expected);
    });
  });

  describe('getMajor', () => {
    it.each`
      version            | expected
      ${'2.39.0-r0'}     | ${2}
      ${'2.39.0_rc1-r0'} | ${2}
    `('getMajor($version) === $expected', ({ version, expected }) => {
      expect(apk.getMajor(version)).toBe(expected);
    });
  });

  describe('getMinor', () => {
    it.each`
      version            | expected
      ${'2.39.0-r0'}     | ${39}
      ${'2.39.0_rc1-r0'} | ${39}
    `('getMinor($version) === $expected', ({ version, expected }) => {
      expect(apk.getMinor(version)).toBe(expected);
    });
  });

  describe('getPatch', () => {
    it.each`
      version                | expected
      ${'2.39.0-r0'}         | ${0}
      ${'2.39.0_rc1-r0'}     | ${0}
      ${'6.5_p20250503-r0'}  | ${null}
      ${'3.9_pre20060124'}   | ${null}
      ${'0.3.4_pre20061029'} | ${4}
    `('getPatch($version) === $expected', ({ version, expected }) => {
      expect(apk.getPatch(version)).toBe(expected);
    });
  });

  describe('compare', () => {
    it.each`
      a                          | b                      | expected
      ${'2.39.0-r1'}             | ${'2.39.0-r0'}         | ${1}
      ${'2.39.1-r0'}             | ${'2.39.0-r0'}         | ${1}
      ${'2.39.0-r0'}             | ${'2.39.1-r0'}         | ${-1}
      ${'2.39.0-r0'}             | ${'2.39.0-r1'}         | ${-1}
      ${'2.39.0'}                | ${'2.39.0'}            | ${0}
      ${'2.39.0'}                | ${'2.39.1'}            | ${-1}
      ${'2.39.1'}                | ${'2.39.0'}            | ${1}
      ${'2.39.0-r0'}             | ${'2.39.0'}            | ${1}
      ${'2.39.0'}                | ${'2.39.0-r0'}         | ${-1}
      ${'2.39.0_beta'}           | ${'2.39.0'}            | ${1}
      ${'2.39.0'}                | ${'2.39.0_beta'}       | ${-1}
      ${'0.3.4_pre20061029'}     | ${'0.3.4_pre20061030'} | ${-1}
      ${'0.3.4_pre20061029'}     | ${'0.3.4_pre20061028'} | ${1}
      ${'0.3.4_pre20061029'}     | ${'0.3.4_alpha'}       | ${1}
      ${'0.3.4_alpha'}           | ${'0.3.4_pre20061029'} | ${-1}
      ${'0.3.4_pre20061029'}     | ${'0.4.0'}             | ${-1}
      ${'0.4.0'}                 | ${'0.3.4_pre20061029'} | ${1}
      ${'2.9.11_pre20061021-r2'} | ${'5.36-r1'}           | ${-1}
      ${'0.3.4_alpha'}           | ${'0.3.4_beta'}        | ${-1}
      ${'0.3.4_beta'}            | ${'0.3.4_alpha'}       | ${1}
    `('compare($a, $b) === $expected', ({ a, b, expected }) => {
      expect(Math.sign(apk.sortVersions(a, b))).toBe(Math.sign(expected));
    });
  });

  describe('isGreaterThan', () => {
    it.each`
      a               | b               | expected
      ${'2.39.1-r0'}  | ${'2.39.0-r0'}  | ${true}
      ${'2.39.0-r1'}  | ${'2.39.0-r0'}  | ${true}
      ${'2.39.0-r0'}  | ${'2.39.1-r0'}  | ${false}
      ${'2.39.0-r0'}  | ${'2.39.0-r1'}  | ${false}
      ${'1.4_p12-r5'} | ${'1.4_p12-r2'} | ${true}
    `('isGreaterThan($a, $b) === $expected', ({ a, b, expected }) => {
      expect(apk.isGreaterThan(a, b)).toBe(expected);
    });
  });

  describe('equals', () => {
    it.each`
      a              | b              | expected
      ${'2.39.0-r0'} | ${'2.39.0-r0'} | ${true}
      ${'2.39.0'}    | ${'2.39.0'}    | ${true}
      ${'2.39.0-r0'} | ${'2.39.0-r1'} | ${false}
      ${'2.39.0'}    | ${'2.39.1'}    | ${false}
    `('equals($a, $b) === $expected', ({ a, b, expected }) => {
      expect(apk.equals(a, b)).toBe(expected);
    });
  });

  describe('getSatisfyingVersion', () => {
    const versions = [
      '2.39.0-r0',
      '2.39.0-r1',
      '2.39.1-r0',
      '2.40.0-r0',
      '2.40.0-r1',
      '3.0.0-r0',
    ];

    it.each`
      range            | expected
      ${'2.39.0-r0'}   | ${'2.39.0-r0'}
      ${'2.39.0-r1'}   | ${'2.39.0-r1'}
      ${'2.40.0-r0'}   | ${'2.40.0-r0'}
      ${'nonexistent'} | ${null}
    `(
      'getSatisfyingVersion with exact match ($range) === $expected',
      ({ range, expected }) => {
        expect(apk.getSatisfyingVersion(versions, range)).toBe(expected);
      },
    );

    it.each`
      range            | expected
      ${'>2.39.0-r0'}  | ${'3.0.0-r0'}
      ${'>=2.39.0-r0'} | ${'3.0.0-r0'}
      ${'<2.40.0-r0'}  | ${'2.39.1-r0'}
      ${'<=2.40.0-r0'} | ${'2.40.0-r0'}
      ${'=2.39.0-r0'}  | ${'2.39.0-r0'}
      ${'==2.39.0-r0'} | ${'2.39.0-r0'}
    `(
      'getSatisfyingVersion with range operator ($range) === $expected',
      ({ range, expected }) => {
        expect(apk.getSatisfyingVersion(versions, range)).toBe(expected);
      },
    );

    it.each`
      range           | expected
      ${'~2.39.0-r0'} | ${'2.39.1-r0'}
      ${'~2.40.0-r0'} | ${'2.40.0-r1'}
    `(
      'getSatisfyingVersion with tilde range ($range) === $expected',
      ({ range, expected }) => {
        expect(apk.getSatisfyingVersion(versions, range)).toBe(expected);
      },
    );

    it('should return null for invalid range operators', () => {
      expect(apk.getSatisfyingVersion(versions, 'invalid-range')).toBe(null);
    });

    it('should return null for empty versions array', () => {
      expect(apk.getSatisfyingVersion([], '2.39.0-r0')).toBe(null);
    });

    it('should filter out invalid versions', () => {
      const mixedVersions = ['2.39.0-r0', 'invalid', '2.40.0-r0'];
      expect(apk.getSatisfyingVersion(mixedVersions, '>2.39.0-r0')).toBe(
        '2.40.0-r0',
      );
    });
  });

  describe('isSingleVersion', () => {
    it.each`
      version         | expected
      ${'2.39.0-r0'}  | ${true}
      ${'2.39.0'}     | ${true}
      ${'~2.39.0-r0'} | ${false}
      ${'>2.39.0-r0'} | ${false}
    `('isSingleVersion($version) === $expected', ({ version, expected }) => {
      expect(apk.isSingleVersion(version)).toBe(expected);
    });

    it('should return false for empty versions', () => {
      expect(apk.isSingleVersion('')).toBe(false);
      expect(apk.isSingleVersion(null as any)).toBe(false);
      expect(apk.isSingleVersion(undefined as any)).toBe(false);
    });
  });

  describe('isLessThanRange', () => {
    it.each`
      version        | range          | expected
      ${'2.39.0-r0'} | ${'2.39.0-r1'} | ${true}
      ${'2.39.0-r1'} | ${'2.39.0-r0'} | ${false}
      ${'2.39.0-r0'} | ${'2.39.0-r0'} | ${false}
      ${'2.38.0-r0'} | ${'2.39.0-r0'} | ${true}
    `(
      'isLessThanRange($version, $range) === $expected',
      ({ version, range, expected }) => {
        expect(apk.isLessThanRange!(version, range)).toBe(expected);
      },
    );
  });

  describe('sortVersions', () => {
    it('should sort versions correctly', () => {
      const versions = ['2.40.0-r0', '2.39.0-r1', '2.39.0-r0', '2.39.1-r0'];
      const sorted = versions.sort((a, b) => apk.sortVersions(a, b));
      expect(sorted).toEqual([
        '2.39.0-r0',
        '2.39.0-r1',
        '2.39.1-r0',
        '2.40.0-r0',
      ]);
    });

    it('should compare release numbers when version parts are equal', () => {
      // Both versions have same version and prerelease, different release numbers
      expect(apk.sortVersions('2.39.0-r1', '2.39.0-r2')).toBeLessThan(0);
      expect(apk.sortVersions('2.39.0-r2', '2.39.0-r1')).toBeGreaterThan(0);
      // Both have no release number (should be equal)
      expect(apk.sortVersions('2.39.0', '2.39.0')).toBe(0);
    });
  });

  describe('complex version parsing', () => {
    it.each`
      version               | expected
      ${'v2.39.0-r0'}       | ${true}
      ${'2.39.0_rc1'}       | ${true}
      ${'2.39.0_beta'}      | ${true}
      ${'6.5_p20250503-r0'} | ${true}
      ${'2.39.0_cvs-r0'}    | ${true}
      ${'2.39.0_git-r0'}    | ${true}
    `(
      'should parse complex versions ($version) === $expected',
      ({ version, expected }) => {
        expect(apk.isValid(version)).toBe(expected);
      },
    );

    it.each`
      version               | expected
      ${'v2.39.0-r0'}       | ${true}
      ${'2.39.0_rc1'}       | ${false}
      ${'2.39.0_beta'}      | ${false}
      ${'6.5_p20250503-r0'} | ${true}
      ${'2.39.0_cvs-r0'}    | ${true}
      ${'2.39.0_git-r0'}    | ${true}
    `(
      'should identify stable versions ($version) === $expected',
      ({ version, expected }) => {
        expect(apk.isStable(version)).toBe(expected);
      },
    );
  });

  describe('version comparison edge cases', () => {
    it.each`
      a                    | b                    | expected
      ${'2.39.0-r0'}       | ${'2.39.0'}          | ${1}
      ${'2.39.0'}          | ${'2.39.0-r0'}       | ${-1}
      ${'2.39.0_beta'}     | ${'2.39.0'}          | ${1}
      ${'2.39.0'}          | ${'2.39.0_beta'}     | ${-1}
      ${'2.39.0_rc1-r0'}   | ${'2.39.0_alpha-r0'} | ${1}
      ${'2.39.0_alpha-r0'} | ${'2.39.0_rc1-r0'}   | ${-1}
    `(
      'should compare versions with prerelease identifiers ($a, $b) === $expected',
      ({ a, b, expected }) => {
        expect(Math.sign(apk.sortVersions(a, b))).toBe(Math.sign(expected));
      },
    );
  });

  describe('error handling', () => {
    it('should handle invalid version parsing gracefully', () => {
      expect(apk.isValid('')).toBe(false);
      expect(apk.isValid('invalid')).toBe(false);
      expect(apk.isValid('a.39.0-')).toBe(false);
      expect(apk.getMajor('invalid')).toBe(null);
      expect(apk.getMinor('invalid')).toBe(null);
      expect(apk.getPatch('invalid')).toBe(null);
      expect(apk.isStable('invalid')).toBe(false);
    });

    it('should handle null/undefined inputs', () => {
      expect(apk.isValid(null as any)).toBe(false);
      expect(apk.isValid(undefined as any)).toBe(false);
      expect(apk.getMajor(null as any)).toBe(null);
      expect(apk.getMinor(undefined as any)).toBe(null);
      expect(apk.getPatch(null as any)).toBe(null);
      expect(apk.getPatch(undefined as any)).toBe(null);
      expect(apk.getPatch('')).toBe(null);
    });

    it('should return false for unstable versions with prerelease', () => {
      expect(apk.isStable('=2.39.0_rc1-r0')).toBe(false);
      expect(apk.isStable('>2.39.0_beta-r0')).toBe(false);
      expect(apk.isStable('~2.39.0_alpha-r0')).toBe(false);
    });

    it('should return false for empty versions in isStable', () => {
      expect(apk.isStable('')).toBe(false);
      expect(apk.isStable(null as any)).toBe(false);
      expect(apk.isStable(undefined as any)).toBe(false);
    });
  });

  describe('getSatisfyingVersion edge cases', () => {
    it('should handle versions with different major versions in tilde range', () => {
      const versions = ['1.0.0-r0', '2.0.0-r0', '2.1.0-r0'];
      expect(apk.getSatisfyingVersion(versions, '~1.0.0-r0')).toBe('1.0.0-r0');
      expect(apk.getSatisfyingVersion(versions, '~2.0.0-r0')).toBe('2.0.0-r0');
    });

    it('should handle versions with different minor versions in tilde range', () => {
      const versions = ['2.0.0-r0', '2.1.0-r0', '2.2.0-r0', '3.0.0-r0'];
      expect(apk.getSatisfyingVersion(versions, '~2.1.0-r0')).toBe('2.1.0-r0');
    });

    it('should handle invalid target versions in ranges', () => {
      const versions = ['2.39.0-r0', '2.40.0-r0'];
      expect(apk.getSatisfyingVersion(versions, '>invalid')).toBe(null);
      expect(apk.getSatisfyingVersion(versions, '~invalid')).toBe(null);
    });

    it('should handle versions with prerelease identifiers in ranges', () => {
      const versions = ['2.39.0-r0', '2.39.0_rc1-r0', '2.40.0-r0'];
      expect(apk.getSatisfyingVersion(versions, '>2.39.0-r0')).toBe(
        '2.40.0-r0',
      );
      expect(apk.getSatisfyingVersion(versions, '>=2.39.0_rc1-r0')).toBe(
        '2.40.0-r0',
      );
    });
  });

  describe('getPatch edge cases', () => {
    it('should return null for _p patterns in getPatch', () => {
      expect(apk.getPatch('6.5_p20250503-r0')).toBe(null);
      expect(apk.getPatch('1.0_p1-r0')).toBe(null);
      expect(apk.getPatch('2.0_package-r0')).toBe(null);
    });

    it('should return patch version for non-_p patterns', () => {
      expect(apk.getPatch('2.39.0-r0')).toBe(0);
      expect(apk.getPatch('2.39.1-r0')).toBe(1);
      expect(apk.getPatch('2.39.0_rc1-r0')).toBe(0);
    });

    it('should handle versions with operators', () => {
      expect(apk.getPatch('=2.39.0-r0')).toBe(0);
      expect(apk.getPatch('>2.39.1-r0')).toBe(1);
      expect(apk.getPatch('~2.39.2-r0')).toBe(2);
    });
  });

  describe('getNewValue', () => {
    it('should strip revision from newVersion when currentValue has no revision', () => {
      expect(
        apk.getNewValue({
          currentValue: '2.50.0',
          rangeStrategy: 'replace',
          newVersion: '2.51.1-r1',
        }),
      ).toBe('2.51.1');
    });

    it('should keep revision in newVersion when currentValue has revision', () => {
      expect(
        apk.getNewValue({
          currentValue: '2.50.0-r0',
          rangeStrategy: 'replace',
          newVersion: '2.51.1-r1',
        }),
      ).toBe('2.51.1-r1');
    });

    it('should handle newVersion without revision when currentValue has no revision', () => {
      expect(
        apk.getNewValue({
          currentValue: '2.50.0',
          rangeStrategy: 'replace',
          newVersion: '2.51.1',
        }),
      ).toBe('2.51.1');
    });

    it('should handle newVersion without revision when currentValue has revision', () => {
      expect(
        apk.getNewValue({
          currentValue: '2.50.0-r0',
          rangeStrategy: 'replace',
          newVersion: '2.51.1',
        }),
      ).toBe('2.51.1');
    });
  });

  describe('version comparison with prerelease identifiers', () => {
    it('should handle complex prerelease identifier comparisons', () => {
      expect(
        apk.sortVersions('2.39.0_alpha-r0', '2.39.0_beta-r0'),
      ).toBeLessThan(0);
      expect(
        apk.sortVersions('2.39.0_beta-r0', '2.39.0_alpha-r0'),
      ).toBeGreaterThan(0);
      expect(apk.sortVersions('2.39.0_rc1-r0', '2.39.0_rc2-r0')).toBeLessThan(
        0,
      );
    });

    it('should handle versions with different prerelease patterns', () => {
      expect(apk.sortVersions('2.39.0-r0', '2.39.0_rc1-r0')).toBeLessThan(0);
      expect(apk.sortVersions('2.39.0_rc1-r0', '2.39.0-r0')).toBeGreaterThan(0);
    });
  });

  describe('getSatisfyingVersion edge cases for coverage', () => {
    it('should handle unknown range operators', () => {
      const versions = ['2.39.0-r0', '2.40.0-r0'];

      // Test unknown operators that would hit the default case
      expect(apk.getSatisfyingVersion(versions, '!2.39.0-r0')).toBe(null);
      expect(apk.getSatisfyingVersion(versions, '?2.39.0-r0')).toBe(null);
      expect(apk.getSatisfyingVersion(versions, '*2.39.0-r0')).toBe(null);
      expect(apk.getSatisfyingVersion(versions, '@2.39.0-r0')).toBe(null);
      expect(apk.getSatisfyingVersion(versions, '#2.39.0-r0')).toBe(null);
    });

    it('should handle tilde range with invalid target version', () => {
      const versions = ['2.39.0-r0', '2.40.0-r0'];

      // This should trigger the null check in tilde range logic when target parsing fails
      expect(apk.getSatisfyingVersion(versions, '~invalid')).toBe(null);
    });

    it('should handle tilde range with invalid version in list', () => {
      const versions = ['2.39.0-r0', 'invalid', '2.40.0-r0'];

      // This should trigger the null check in tilde range logic when version parsing fails
      expect(apk.getSatisfyingVersion(versions, '~2.39.0-r0')).toBe(
        '2.39.0-r0',
      );
    });
  });

  describe('version comparison edge cases for coverage', () => {
    it('should handle letter vs number comparison in _compareVersionParts', () => {
      // Test case where we compare a letter to a number
      // This should trigger the "letters are less than numbers" path
      expect(apk.sortVersions('2.39.0a-r0', '2.39.0-r0')).toBeLessThan(0);
      expect(apk.sortVersions('2.39.0-r0', '2.39.0a-r0')).toBeGreaterThan(0);
    });

    it('should handle number vs letter comparison in _compareVersionParts', () => {
      // Test case where we compare a number to a letter
      // This should trigger the "numbers are greater than letters" path
      // We need versions where the first has more numeric parts than the second
      expect(apk.sortVersions('2.39.0.1-r0', '2.39.0a-r0')).toBeGreaterThan(0);
      expect(apk.sortVersions('2.39.0a-r0', '2.39.0.1-r0')).toBeLessThan(0);
    });

    it('should handle number vs undefined comparison in _compareVersionParts', () => {
      // Test case where we compare a number to undefined (shorter version)
      // This should trigger the "numbers are greater than letters" path
      // When v1 has more parts than v2, matchv2 will be undefined
      expect(apk.sortVersions('2.39.0.1-r0', '2.39.0-r0')).toBeGreaterThan(0);
      expect(apk.sortVersions('2.39.0-r0', '2.39.0.1-r0')).toBeLessThan(0);
    });

    it('should handle string vs string comparison in _compareVersionParts', () => {
      // Test case where we compare two different strings
      // This should trigger the lexicographic comparison path
      expect(apk.sortVersions('2.39.0a-r0', '2.39.0b-r0')).toBeLessThan(0);
      expect(apk.sortVersions('2.39.0b-r0', '2.39.0a-r0')).toBeGreaterThan(0);
    });

    it('should handle undefined vs string comparison in _compareVersionParts', () => {
      // Test case where one version has more parts than the other
      // This should trigger the "One is undefined, the other exists" path
      // where matchv1 exists and matchv2 is undefined
      expect(apk.sortVersions('2.39.0.1-r0', '2.39.0-r0')).toBeGreaterThan(0);
      expect(apk.sortVersions('2.39.0-r0', '2.39.0.1-r0')).toBeLessThan(0);
    });

    it('should handle equal version comparison in _compareVersionParts', () => {
      // Test case where versions are exactly equal
      // This should trigger the final return 0 in _compareVersionParts
      expect(apk.sortVersions('2.39.0-r0', '2.39.0-r0')).toBe(0);
      expect(apk.sortVersions('1.0.0', '1.0.0')).toBe(0);
      expect(apk.sortVersions('0.3.4_pre20061029', '0.3.4_pre20061029')).toBe(
        0,
      );
      expect(apk.sortVersions('6.5_p20250503-r0', '6.5_p20250503-r0')).toBe(0);

      // Test with more complex equal versions to ensure we hit the return 0 path
      expect(apk.sortVersions('2.39.0a-r0', '2.39.0a-r0')).toBe(0);
      expect(apk.sortVersions('2.39.0_beta-r0', '2.39.0_beta-r0')).toBe(0);
      expect(apk.sortVersions('2.39.0_rc1-r0', '2.39.0_rc1-r0')).toBe(0);
    });

    it('should handle versions with different lengths in _compareVersionParts', () => {
      // Test case where one version has more parts than the other
      // This should trigger the remaining segments logic
      expect(apk.sortVersions('2.39.0.1-r0', '2.39.0-r0')).toBeGreaterThan(0);
      expect(apk.sortVersions('2.39.0-r0', '2.39.0.1-r0')).toBeLessThan(0);
      // Test with valid APK version formats
      expect(apk.sortVersions('2.39.0_rc1-r0', '2.39.0-r0')).toBeGreaterThan(0);
      expect(apk.sortVersions('2.39.0-r0', '2.39.0_rc1-r0')).toBeLessThan(0);
    });

    it('should handle versions with equal parts but different lengths', () => {
      // Test case where all common parts are equal but one version has more parts
      // This should trigger the final return 0 path when all parts are equal
      expect(apk.sortVersions('2.39.0', '2.39.0')).toBe(0);
      expect(apk.sortVersions('2.39.0a', '2.39.0a')).toBe(0);
    });

    it('should handle versions where one has more parts during main comparison', () => {
      // Test case where one version has more parts than the other during the main comparison loop
      // This should trigger the else block where one is undefined, the other exists
      // We need versions where the for loop runs but one version has fewer parts
      expect(apk.sortVersions('2.39.0.1', '2.39.0')).toBeGreaterThan(0);
      expect(apk.sortVersions('2.39.0', '2.39.0.1')).toBeLessThan(0);
    });

    it('should handle versions with different lengths where for loop runs but one has fewer parts', () => {
      // Test case where the for loop runs but one version has fewer parts
      // This should trigger the else block where one is undefined, the other exists
      // In APK versioning, letters are less than numbers, so 2.39.0a < 2.39.0
      expect(apk.sortVersions('2.39.0a', '2.39.0')).toBeLessThan(0);
      expect(apk.sortVersions('2.39.0', '2.39.0a')).toBeGreaterThan(0);
    });

    it('should handle versions where regex matches different numbers of parts', () => {
      // Test case where the regex matches different numbers of parts for the two versions
      // This should trigger the else block where one is undefined, the other exists
      // We need versions where the regex produces different numbers of matches
      expect(apk.sortVersions('2.39.0a', '2.39.0b')).toBeLessThan(0);
      expect(apk.sortVersions('2.39.0b', '2.39.0a')).toBeGreaterThan(0);
    });

    it('should handle versions with different lengths in remaining segments', () => {
      // Test case where versions have different lengths and we need to handle remaining segments
      // This should trigger the remaining segments logic
      expect(apk.sortVersions('2.39.0.1.2', '2.39.0.1')).toBeGreaterThan(0);
      expect(apk.sortVersions('2.39.0.1', '2.39.0.1.2')).toBeLessThan(0);
    });
  });
});
