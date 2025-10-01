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

    it.each`
      range           | expected
      ${'^2.39.0-r0'} | ${'2.40.0-r1'}
      ${'^2.40.0-r0'} | ${'2.40.0-r1'}
      ${'^3.0.0-r0'}  | ${'3.0.0-r0'}
    `(
      'getSatisfyingVersion with caret range ($range) === $expected',
      ({ range, expected }) => {
        expect(apk.getSatisfyingVersion(versions, range)).toBe(expected);
      },
    );

    it('should handle 0.x.x versions with caret range', () => {
      const zeroVersions = ['0.1.0-r0', '0.1.1-r0', '0.2.0-r0', '1.0.0-r0'];
      expect(apk.getSatisfyingVersion(zeroVersions, '^0.1.0-r0')).toBe(
        '0.1.1-r0',
      );
      expect(apk.getSatisfyingVersion(zeroVersions, '^0.2.0-r0')).toBe(
        '0.2.0-r0',
      );
    });

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
      ${'^2.39.0-r0'} | ${false}
      ${'~2.39.0-r0'} | ${false}
      ${'>2.39.0-r0'} | ${false}
    `('isSingleVersion($version) === $expected', ({ version, expected }) => {
      expect(apk.isSingleVersion(version)).toBe(expected);
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

    it('should handle 0.x.x versions with caret range edge cases', () => {
      const zeroVersions = [
        '0.0.1-r0',
        '0.1.0-r0',
        '0.1.1-r0',
        '0.2.0-r0',
        '1.0.0-r0',
      ];
      expect(apk.getSatisfyingVersion(zeroVersions, '^0.0.1-r0')).toBe(
        '1.0.0-r0',
      );
      expect(apk.getSatisfyingVersion(zeroVersions, '^0.1.0-r0')).toBe(
        '0.1.1-r0',
      );
    });

    it('should handle invalid target versions in ranges', () => {
      const versions = ['2.39.0-r0', '2.40.0-r0'];
      expect(apk.getSatisfyingVersion(versions, '>invalid')).toBe(null);
      expect(apk.getSatisfyingVersion(versions, '~invalid')).toBe(null);
      expect(apk.getSatisfyingVersion(versions, '^invalid')).toBe(null);
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
    it('should handle 0.x.x versions where getMinor returns null', () => {
      // Test case where getMinor might return null for malformed 0.x versions
      const malformedVersions = ['0', '0.1.0-r0', '1.0.0-r0'];

      // This should trigger the null check in caret range logic
      expect(apk.getSatisfyingVersion(malformedVersions, '^0.1.0-r0')).toBe(
        '0.1.0-r0',
      );
    });

    it('should handle versions where getMajor returns null in caret range', () => {
      // Test case where getMajor might return null for malformed versions
      const malformedVersions = ['invalid', '2.39.0-r0', '3.0.0-r0'];

      // This should trigger the null check in caret range logic for getMajor
      // The invalid version should be filtered out, and 2.39.0-r0 should match
      expect(apk.getSatisfyingVersion(malformedVersions, '^2.39.0-r0')).toBe(
        '2.39.0-r0',
      );
    });

    it('should handle target version with null getMajor in caret range', () => {
      // Test case where the target version itself has null getMajor
      const versions = ['2.39.0-r0', '3.0.0-r0'];

      // This should trigger the null check for targetMajor in caret range logic
      expect(apk.getSatisfyingVersion(versions, '^invalid')).toBe(null);
    });

    it('should handle unknown range operators', () => {
      const versions = ['2.39.0-r0', '2.40.0-r0'];

      // Test unknown operators that would hit the default case
      expect(apk.getSatisfyingVersion(versions, '!2.39.0-r0')).toBe(null);
      expect(apk.getSatisfyingVersion(versions, '?2.39.0-r0')).toBe(null);
      expect(apk.getSatisfyingVersion(versions, '*2.39.0-r0')).toBe(null);
    });

    it('should handle tilde range with invalid target version', () => {
      const versions = ['2.39.0-r0', '2.40.0-r0'];

      // This should trigger the null check in tilde range logic when target parsing fails
      expect(apk.getSatisfyingVersion(versions, '~invalid')).toBe(null);
    });

    it('should handle caret range with null getMajor for target version', () => {
      const versions = ['2.39.0-r0', '3.0.0-r0'];

      // This should trigger the null check for targetMajor in caret range logic
      expect(apk.getSatisfyingVersion(versions, '^invalid')).toBe(null);
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
  });
});
