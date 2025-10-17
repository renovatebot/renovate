import semverPartial from '.';

describe('modules/versioning/semver-partial/index', () => {
  describe('.isValid()', () => {
    it.each`
      version          | expected
      ${'1'}           | ${true}
      ${'1.2'}         | ${true}
      ${'1.2.3'}       | ${true}
      ${'~latest'}     | ${true}
      ${'1.2.3-alpha'} | ${true}
      ${'invalid'}     | ${false}
      ${''}            | ${false}
    `('isValid("$version") === $expected', ({ version, expected }) => {
      expect(semverPartial.isValid(version)).toBe(expected);
    });
  });

  describe('.isVersion()', () => {
    it.each`
      version          | expected
      ${'1'}           | ${false}
      ${'1.2'}         | ${false}
      ${'1.2.3'}       | ${true}
      ${'~latest'}     | ${false}
      ${'1.2.3-alpha'} | ${true}
      ${'1.2.3-rc.1'}  | ${true}
      ${'invalid'}     | ${false}
      ${''}            | ${false}
      ${'#1.0.0'}      | ${false}
      ${'x1.0.0'}      | ${false}
    `('isVersion("$version") === $expected', ({ version, expected }) => {
      expect(semverPartial.isVersion(version)).toBe(expected);
    });
  });

  describe('.isStable()', () => {
    it.each`
      version             | expected
      ${'1.0.0-alpha'}    | ${false}
      ${'1.0.0-beta'}     | ${false}
      ${'1.0.0-rc'}       | ${false}
      ${'1.0.0-pre'}      | ${false}
      ${'1.0.0-dev'}      | ${false}
      ${'1.0.0-snapshot'} | ${false}
      ${'1.0.0-unstable'} | ${false}
      ${'1.0.0-Alpha'}    | ${false}
      ${'1.0.0-1'}        | ${false}
      ${'1.0.0-build.1'}  | ${false}
      ${'1.0.0'}          | ${true}
      ${'1'}              | ${false}
      ${'not-a-version'}  | ${false}
    `('isStable("$version") === $expected', ({ version, expected }) => {
      expect(semverPartial.isStable(version)).toBe(expected);
    });
  });

  describe('.isSingleVersion()', () => {
    it.each`
      version          | expected
      ${'1'}           | ${false}
      ${'1.2'}         | ${false}
      ${'1.2.3'}       | ${true}
      ${'~latest'}     | ${false}
      ${'1.2.3-alpha'} | ${true}
    `('isSingleVersion("$version") === $expected', ({ version, expected }) => {
      expect(semverPartial.isSingleVersion(version)).toBe(expected);
    });
  });

  describe('.matches()', () => {
    it.each`
      version             | range        | expected
      ${'1.1.0'}          | ${'1.0'}     | ${false}
      ${'1.0.0'}          | ${'1'}       | ${true}
      ${'1.2.0'}          | ${'1'}       | ${true}
      ${'1.2.3'}          | ${'1'}       | ${true}
      ${'2.0.0'}          | ${'1'}       | ${false}
      ${'1.1.0'}          | ${'1.1'}     | ${true}
      ${'1.1.5'}          | ${'1.1'}     | ${true}
      ${'1.2.0'}          | ${'1.1'}     | ${false}
      ${'1.0.0'}          | ${'1.1'}     | ${false}
      ${'1.2.3'}          | ${'1.2'}     | ${true}
      ${'1.2.0'}          | ${'1.2'}     | ${true}
      ${'1.3.0'}          | ${'1.2'}     | ${false}
      ${'1.0.0'}          | ${'~latest'} | ${true}
      ${'2.1.0'}          | ${'~latest'} | ${true}
      ${'1.0.0-rc'}       | ${'1'}       | ${false}
      ${'1.0.0-rc'}       | ${'1.0'}     | ${false}
      ${'invalid'}        | ${'1'}       | ${false}
      ${'~latest'}        | ${'1'}       | ${false}
      ${'1'}              | ${'1'}       | ${false}
      ${'1.2'}            | ${'1.2'}     | ${false}
      ${'1.2.3'}          | ${'1.2.3'}   | ${true}
      ${'1.2.4'}          | ${'1.2.3'}   | ${false}
      ${'not-semver-ver'} | ${'1'}       | ${false}
      ${'1.0.0-alpha'}    | ${'1'}       | ${false}
      ${'1.0.0-beta'}     | ${'1.0'}     | ${false}
    `(
      'matches("$version", "$range") === $expected',
      ({ version, range, expected }) => {
        expect(semverPartial.matches(version, range)).toBe(expected);
      },
    );

    it('should handle invalid range that is not ~latest or valid version', () => {
      expect(semverPartial.matches('1.0.0', 'completely-invalid-range')).toBe(
        false,
      );
    });
  });

  describe('.getSatisfyingVersion()', () => {
    it.each`
      versions                                                     | range        | expected
      ${['1.0.0', '1.1.0', '1.1.1', '1.2.0', '2.0.0', '2.0.1']}    | ${'1'}       | ${'1.2.0'}
      ${['1.0.0', '1.1.0', '1.1.1', '1.2.0', '2.0.0', '2.0.1']}    | ${'1.1'}     | ${'1.1.1'}
      ${['1.0.0', '1.1.0', '1.1.1', '1.2.0', '2.0.0', '2.0.1']}    | ${'2'}       | ${'2.0.1'}
      ${['1.0.0', '1.1.0', '1.1.1', '1.2.0', '2.0.0', '2.1.0']}    | ${'~latest'} | ${'2.1.0'}
      ${['1.0.0', '1.1.0', '1.2.0', '2.0.0', '2.0.1', '2.1.0-rc']} | ${'2'}       | ${'2.0.1'}
      ${['1.0.0', '1.0.1-rc', '1.1.0']}                            | ${'1.0'}     | ${'1.0.0'}
      ${['0.5.0', '1.0.0', '2.0.0']}                               | ${'3'}       | ${null}
      ${['invalid-version', '1.0.0']}                              | ${'1'}       | ${'1.0.0'}
      ${['1.0', '1.1', '1.2']}                                     | ${'1'}       | ${null}
      ${['0.9.0-alpha', '0.9.0-beta', '0.9.0']}                    | ${'~latest'} | ${'0.9.0'}
      ${['some-text', 'another-text']}                             | ${'1'}       | ${null}
      ${['not-valid', 'also-bad']}                                 | ${'1'}       | ${null}
      ${['1.0.0', '1.0.1-alpha', '1.0.2', '1.1.0-beta', '1.1.1']}  | ${'1'}       | ${'1.1.1'}
      ${['1.0.0', '1.0.1-alpha', '1.0.2', '1.1.0-beta', '1.1.1']}  | ${'1.0'}     | ${'1.0.2'}
    `(
      'getSatisfyingVersion($versions, "$range") === $expected',
      ({ versions, range, expected }) => {
        expect(semverPartial.getSatisfyingVersion(versions, range)).toBe(
          expected,
        );
      },
    );
  });

  describe('.minSatisfyingVersion()', () => {
    it.each`
      versions                                                  | range        | expected
      ${['1.0.0', '1.1.0', '1.1.1', '1.2.0', '2.0.0']}          | ${'1'}       | ${'1.0.0'}
      ${['1.0.0', '1.1.0', '1.1.1', '1.2.0', '2.0.0']}          | ${'1.1'}     | ${'1.1.0'}
      ${['1.0.0', '1.1.0', '1.1.1', '1.2.0', '2.0.0', '2.0.1']} | ${'2'}       | ${'2.0.0'}
      ${['1.0.0', '1.1.0', '1.2.0', '2.0.0', '2.0.1', '2.1.0']} | ${'~latest'} | ${'1.0.0'}
      ${['1.0.0', '1.0.1-rc', '1.1.0']}                         | ${'1.0'}     | ${'1.0.0'}
      ${['0.5.0', '1.0.0', '2.0.0']}                            | ${'3'}       | ${null}
    `(
      'minSatisfyingVersion($versions, "$range") === $expected',
      ({ versions, range, expected }) => {
        expect(semverPartial.minSatisfyingVersion(versions, range)).toBe(
          expected,
        );
      },
    );
  });

  describe('.isLessThanRange()', () => {
    it.each`
      version      | range        | expected
      ${'0.9.0'}   | ${'1'}       | ${true}
      ${'1.0.0'}   | ${'1'}       | ${false}
      ${'1.5.0'}   | ${'1'}       | ${false}
      ${'2.0.0'}   | ${'1'}       | ${false}
      ${'1.0.0'}   | ${'1.1'}     | ${true}
      ${'1.1.0'}   | ${'1.1'}     | ${false}
      ${'1.2.0'}   | ${'1.1'}     | ${false}
      ${'0.9.0'}   | ${'~latest'} | ${false}
      ${'1.0.0'}   | ${'~latest'} | ${false}
      ${'1.5.0'}   | ${'1'}       | ${false}
      ${'invalid'} | ${'1'}       | ${false}
    `(
      'isLessThanRange("$version", "$range") === $expected',
      ({ version, range, expected }) => {
        expect(semverPartial.isLessThanRange?.(version, range)).toBe(expected);
      },
    );
  });

  describe('.equals()', () => {
    it.each`
      version      | other        | expected
      ${'1.0.0'}   | ${'1.0.0'}   | ${true}
      ${'1.0.0'}   | ${'1.0.1'}   | ${false}
      ${'invalid'} | ${'1.0.0'}   | ${false}
      ${'1.0.0'}   | ${'invalid'} | ${false}
      ${'invalid'} | ${'invalid'} | ${false}
    `(
      'equals("$version", "$other") === $expected',
      ({ version, other, expected }) => {
        expect(semverPartial.equals(version, other)).toBe(expected);
      },
    );
  });

  describe('.getMajor()', () => {
    it.each`
      version      | expected
      ${'1.0.0'}   | ${1}
      ${'2.3.4'}   | ${2}
      ${'invalid'} | ${null}
    `('getMajor("$version") === $expected', ({ version, expected }) => {
      expect(semverPartial.getMajor(version)).toBe(expected);
    });
  });

  describe('.getMinor()', () => {
    it.each`
      version      | expected
      ${'1.0.0'}   | ${0}
      ${'2.3.4'}   | ${3}
      ${'invalid'} | ${null}
    `('getMinor("$version") === $expected', ({ version, expected }) => {
      expect(semverPartial.getMinor(version)).toBe(expected);
    });
  });

  describe('.getPatch()', () => {
    it.each`
      version      | expected
      ${'1.0.0'}   | ${0}
      ${'2.3.4'}   | ${4}
      ${'invalid'} | ${null}
    `('getPatch("$version") === $expected', ({ version, expected }) => {
      expect(semverPartial.getPatch(version)).toBe(expected);
    });
  });

  describe('.isGreaterThan()', () => {
    it.each`
      version      | other        | expected
      ${'1.0.1'}   | ${'1.0.0'}   | ${true}
      ${'1.0.0'}   | ${'1.0.1'}   | ${false}
      ${'2.0.0'}   | ${'1.9.9'}   | ${true}
      ${'invalid'} | ${'1.0.0'}   | ${false}
      ${'1.0.0'}   | ${'invalid'} | ${false}
    `(
      'isGreaterThan("$version", "$other") === $expected',
      ({ version, other, expected }) => {
        expect(semverPartial.isGreaterThan(version, other)).toBe(expected);
      },
    );
  });

  describe('.sortVersions()', () => {
    it.each`
      a            | b            | expected
      ${'1.0.0'}   | ${'1.0.0'}   | ${0}
      ${'1.0.0'}   | ${'1.0.1'}   | ${-1}
      ${'1.0.1'}   | ${'1.0.0'}   | ${1}
      ${'2.0.0'}   | ${'1.9.9'}   | ${1}
      ${'invalid'} | ${'1.0.0'}   | ${0}
      ${'1.0.0'}   | ${'invalid'} | ${0}
      ${'invalid'} | ${'invalid'} | ${0}
    `('sortVersions("$a", "$b") === $expected', ({ a, b, expected }) => {
      expect(semverPartial.sortVersions(a, b)).toBe(expected);
    });
  });

  describe('.isBreaking()', () => {
    it.each`
      version      | current      | expected
      ${'2.0.0'}   | ${'1.0.0'}   | ${true}
      ${'1.1.0'}   | ${'1.0.0'}   | ${false}
      ${'1.0.1'}   | ${'1.0.0'}   | ${false}
      ${'0.2.0'}   | ${'0.1.0'}   | ${true}
      ${'0.1.1'}   | ${'0.1.0'}   | ${false}
      ${'1.0.0'}   | ${'0.9.0'}   | ${true}
      ${'invalid'} | ${'1.0.0'}   | ${false}
      ${'1.0.0'}   | ${'invalid'} | ${false}
    `(
      'isBreaking("$version", "$current") === $expected',
      ({ version, current, expected }) => {
        expect(semverPartial.isBreaking!(version, current)).toBe(expected);
      },
    );
  });

  describe('.isCompatible()', () => {
    it.each`
      version      | expected
      ${'1.0.0'}   | ${true}
      ${'1'}       | ${true}
      ${'~latest'} | ${true}
      ${'invalid'} | ${false}
    `('isCompatible("$version") === $expected', ({ version, expected }) => {
      expect(semverPartial.isCompatible(version)).toBe(expected);
    });
  });

  describe('.getNewValue()', () => {
    it.each`
      currentValue | rangeStrategy | currentVersion | newVersion   | expected
      ${'1'}       | ${'pin'}      | ${'1.0.0'}     | ${'1.1.0'}   | ${'1.1.0'}
      ${'1.2'}     | ${'pin'}      | ${'1.2.0'}     | ${'1.2.1'}   | ${'1.2.1'}
      ${'1.2.3'}   | ${'pin'}      | ${'1.2.3'}     | ${'1.2.4'}   | ${'1.2.4'}
      ${'2'}       | ${'pin'}      | ${'2.0.0'}     | ${'2.1.0'}   | ${'2.1.0'}
      ${'2.5'}     | ${'pin'}      | ${'2.5.0'}     | ${'2.5.3'}   | ${'2.5.3'}
      ${'10'}      | ${'pin'}      | ${'10.0.0'}    | ${'10.1.0'}  | ${'10.1.0'}
      ${'~latest'} | ${'pin'}      | ${'1.0.0'}     | ${'1.1.0'}   | ${'1.1.0'}
      ${'1.0.0'}   | ${'pin'}      | ${'1.0.0'}     | ${'1.1.0'}   | ${'1.1.0'}
      ${'1'}       | ${'replace'}  | ${'1.0.0'}     | ${'1.1.0'}   | ${'1'}
      ${'1'}       | ${'replace'}  | ${'1.0.0'}     | ${'2.0.0'}   | ${'2'}
      ${'1.2'}     | ${'replace'}  | ${'1.2.0'}     | ${'1.2.1'}   | ${'1.2'}
      ${'1.2'}     | ${'replace'}  | ${'1.2.0'}     | ${'1.3.0'}   | ${'1.3'}
      ${'1.2.3'}   | ${'replace'}  | ${'1.2.3'}     | ${'1.2.4'}   | ${'1.2.4'}
      ${'1.2.3'}   | ${'replace'}  | ${'1.2.3'}     | ${'1.3.0'}   | ${'1.3.0'}
      ${'1'}       | ${'replace'}  | ${'1.0.0'}     | ${'1.2.0'}   | ${'1'}
      ${'1.2'}     | ${'replace'}  | ${'1.2.0'}     | ${'2.0.0'}   | ${'2.0'}
      ${'2'}       | ${'replace'}  | ${'2.0.0'}     | ${'3.0.0'}   | ${'3'}
      ${'2.1'}     | ${'replace'}  | ${'2.1.0'}     | ${'2.2.0'}   | ${'2.2'}
      ${'10.5'}    | ${'replace'}  | ${'10.5.0'}    | ${'10.6.0'}  | ${'10.6'}
      ${'~latest'} | ${'replace'}  | ${'1.0.0'}     | ${'2.0.0'}   | ${'~latest'}
      ${'1.0.0'}   | ${'replace'}  | ${'1.0.0'}     | ${'1.1.0'}   | ${'1.1.0'}
      ${'1'}       | ${'replace'}  | ${'1.0.0'}     | ${'invalid'} | ${'invalid'}
    `(
      'getNewValue("$currentValue", "$rangeStrategy", "$currentVersion", "$newVersion") === "$expected"',
      ({
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
        expected,
      }) => {
        expect(
          semverPartial.getNewValue({
            currentValue,
            rangeStrategy,
            currentVersion,
            newVersion,
          }),
        ).toBe(expected);
      },
    );
  });
});
