import semverExtended from './index.ts';

describe('modules/versioning/semver-extended/index', () => {
  it.each`
    version                       | expected
    ${'1'}                        | ${false}
    ${'1.2'}                      | ${false}
    ${'1.2.3'}                    | ${true}
    ${'0.6.0.1'}                  | ${true}
    ${'27.3.4.19'}                | ${true}
    ${'1.2.3.4.5.6.7.8.9.10'}     | ${true}
    ${'1.2.3.4.5.6.7.8.9.10.11'}  | ${false}
    ${'v1.2.3'}                   | ${true}
    ${'V1.2.3.4'}                 | ${true}
    ${'01.2.3'}                   | ${true}
    ${'1.2.3-beta'}               | ${true}
    ${'1.2.3.4-rc.1'}             | ${true}
    ${'1.2.3-0'}                  | ${true}
    ${'1.2.3-0-1'}                | ${true}
    ${'1.2.3-0a'}                 | ${true}
    ${'1.2.3-01'}                 | ${false}
    ${'1.2.3-'}                   | ${false}
    ${'1.2.3-beta..1'}            | ${false}
    ${'1.2.3+build.5'}            | ${true}
    ${'1.2.3.4-alpha.1+build-01'} | ${true}
    ${'1.2.3+'}                   | ${false}
    ${'1.2.3.Final'}              | ${false}
    ${'1.2.3a'}                   | ${false}
    ${'1.2.'}                     | ${false}
    ${'.1.2'}                     | ${false}
    ${'^1.2.3'}                   | ${false}
    ${'foo'}                      | ${false}
    ${''}                         | ${false}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(semverExtended.isValid(version)).toBe(expected);
    expect(semverExtended.isVersion(version)).toBe(expected);
    expect(semverExtended.isSingleVersion(version)).toBe(expected);
    expect(semverExtended.isCompatible(version, '1.0.0')).toBe(expected);
  });

  it.each`
    version            | expected
    ${'1.2.3.4'}       | ${true}
    ${'1.2.3.4+build'} | ${true}
    ${'1.2.3.4-rc.1'}  | ${false}
    ${'foo'}           | ${false}
  `('isStable("$version") === $expected', ({ version, expected }) => {
    expect(semverExtended.isStable(version)).toBe(expected);
  });

  it.each`
    version            | major   | minor   | patch
    ${'27.3.4.19'}     | ${27}   | ${3}    | ${4}
    ${'v1.2.3-rc.1'}   | ${1}    | ${2}    | ${3}
    ${'1.2.0'}         | ${1}    | ${2}    | ${0}
    ${'1.2'}           | ${null} | ${null} | ${null}
    ${'1.2.3.4.Final'} | ${null} | ${null} | ${null}
  `(
    'getMajor/getMinor/getPatch("$version") === $major/$minor/$patch',
    ({ version, major, minor, patch }) => {
      expect(semverExtended.getMajor(version)).toBe(major);
      expect(semverExtended.getMinor(version)).toBe(minor);
      expect(semverExtended.getPatch(version)).toBe(patch);
    },
  );

  it.each`
    a                                 | b                                 | expected
    ${'1.2.0'}                        | ${'1.2.0.0'}                      | ${true}
    ${'1.0.0.0.0'}                    | ${'1.0.0'}                        | ${true}
    ${'v1.2.3.4'}                     | ${'1.2.3.4'}                      | ${true}
    ${'1.2.3.4+build.1'}              | ${'1.2.3.4+build.2'}              | ${true}
    ${'1.2.3.4-rc.1+a'}               | ${'1.2.3.4-rc.1'}                 | ${true}
    ${'01.2.3'}                       | ${'1.2.3'}                        | ${true}
    ${'1.2.3.4'}                      | ${'1.2.3.5'}                      | ${false}
    ${'1.2.3.4-rc.1'}                 | ${'1.2.3.4'}                      | ${false}
    ${'1.2.3.4-rc.1'}                 | ${'1.2.3.4-rc.2'}                 | ${false}
    ${'1.2.3.2026051723231779060202'} | ${'1.2.3.2026051723231779060208'} | ${false}
    ${'foo'}                          | ${'1.2.3'}                        | ${false}
    ${'1.2.3'}                        | ${'foo'}                          | ${false}
  `('equals("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(semverExtended.equals(a, b)).toBe(expected);
    expect(semverExtended.matches(a, b)).toBe(expected);
  });

  it.each`
    a                                 | b                                 | expected
    ${'1.2.3.5'}                      | ${'1.2.3.4'}                      | ${true}
    ${'1.2.3.4'}                      | ${'1.2.3.5'}                      | ${false}
    ${'1.2.3.1'}                      | ${'1.2.3'}                        | ${true}
    ${'1.2.3'}                        | ${'1.2.3.1'}                      | ${false}
    ${'1.2.3.0'}                      | ${'1.2.3'}                        | ${false}
    ${'1.10.0'}                       | ${'1.9.9.9'}                      | ${true}
    ${'1.2.3.2026051723231779060208'} | ${'1.2.3.2026051723231779060202'} | ${true}
    ${'1.2.3.4'}                      | ${'1.2.3.4-rc.1'}                 | ${true}
    ${'1.2.3.4-rc.1'}                 | ${'1.2.3.4'}                      | ${false}
    ${'1.2.3.4-rc.1'}                 | ${'1.2.3.3'}                      | ${true}
    ${'1.0.0-alpha.1'}                | ${'1.0.0-alpha'}                  | ${true}
    ${'1.0.0-alpha'}                  | ${'1.0.0-alpha.1'}                | ${false}
    ${'1.0.0-alpha.beta'}             | ${'1.0.0-alpha.1'}                | ${true}
    ${'1.0.0-alpha.1'}                | ${'1.0.0-alpha.beta'}             | ${false}
    ${'1.0.0-beta'}                   | ${'1.0.0-alpha.beta'}             | ${true}
    ${'1.0.0-beta.11'}                | ${'1.0.0-beta.2'}                 | ${true}
    ${'1.0.0-beta.2'}                 | ${'1.0.0-beta.11'}                | ${false}
    ${'1.0.0-rc.1'}                   | ${'1.0.0-beta.11'}                | ${true}
    ${'1.0.0-beta.2'}                 | ${'1.0.0-beta.2'}                 | ${false}
    ${'1.0.0-rc.1+b'}                 | ${'1.0.0-rc.1+a'}                 | ${false}
  `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(semverExtended.isGreaterThan(a, b)).toBe(expected);
  });

  it('sorts versions', () => {
    const versions = [
      '1.0.0',
      '1.0.0-rc.1',
      '0.6.0.1',
      '1.0.0-alpha.beta',
      '1.0.0.1',
      '1.0.0-alpha',
      '1.0.0-beta.11',
      '1.0.0-alpha.1',
      '1.0.0-beta.2',
      '1.0.0-beta',
      '0.6.0',
    ];

    const sorted = versions.toSorted((a, b) =>
      semverExtended.sortVersions(a, b),
    );

    expect(sorted).toEqual([
      '0.6.0',
      '0.6.0.1',
      '1.0.0-alpha',
      '1.0.0-alpha.1',
      '1.0.0-alpha.beta',
      '1.0.0-beta',
      '1.0.0-beta.2',
      '1.0.0-beta.11',
      '1.0.0-rc.1',
      '1.0.0',
      '1.0.0.1',
    ]);
  });

  it.each`
    version      | range        | expected
    ${'1.2.3.3'} | ${'1.2.3.4'} | ${true}
    ${'1.2.3.4'} | ${'1.2.3.4'} | ${false}
    ${'1.2.3.5'} | ${'1.2.3.4'} | ${false}
  `(
    'isLessThanRange("$version", "$range") === $expected',
    ({ version, range, expected }) => {
      expect(semverExtended.isLessThanRange?.(version, range)).toBe(expected);
    },
  );

  it.each`
    versions                         | range        | expected
    ${['1.2.3', '1.2.3.4', '1.2.4']} | ${'1.2.3.4'} | ${'1.2.3.4'}
    ${['1.2.3', '1.2.4']}            | ${'1.2.3.0'} | ${'1.2.3'}
    ${['1.2.3', '1.2.4']}            | ${'1.2.3.4'} | ${null}
  `(
    'getSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(semverExtended.getSatisfyingVersion(versions, range)).toBe(
        expected,
      );
      expect(semverExtended.minSatisfyingVersion(versions, range)).toBe(
        expected,
      );
    },
  );

  it.each`
    type       | a                               | b                               | expected
    ${'major'} | ${'1.2.3.4'}                    | ${'1.5.6.7'}                    | ${true}
    ${'major'} | ${'1.2.3.4'}                    | ${'2.2.3.4'}                    | ${false}
    ${'minor'} | ${'1.2.3.4'}                    | ${'1.2.6.7'}                    | ${true}
    ${'minor'} | ${'1.0.0'}                      | ${'1.0.1.5'}                    | ${true}
    ${'minor'} | ${'1.2.3.4'}                    | ${'1.3.3.4'}                    | ${false}
    ${'patch'} | ${'1.2.3.4'}                    | ${'1.2.3.7'}                    | ${true}
    ${'patch'} | ${'1.2.2026051723231779060202'} | ${'1.2.2026051723231779060208'} | ${false}
    ${'patch'} | ${'1.2.3.4'}                    | ${'1.2.4.4'}                    | ${false}
    ${'major'} | ${'foo'}                        | ${'1.0.0'}                      | ${false}
    ${'major'} | ${'1.0.0'}                      | ${'1'}                          | ${false}
  `('isSame("$type", "$a", "$b") === $expected', ({ type, a, b, expected }) => {
    expect(semverExtended.isSame?.(type, a, b)).toBe(expected);
  });

  it.each`
    current         | version         | expected
    ${'0.6.0.1'}    | ${'0.7.0.0'}    | ${true}
    ${'0.6.0.1'}    | ${'0.6.0.2'}    | ${true}
    ${'0.0.0.1'}    | ${'0.0.0.2'}    | ${true}
    ${'27.3.4.19'}  | ${'27.3.4.20'}  | ${false}
    ${'27.3.4.19'}  | ${'27.4.0.0'}   | ${false}
    ${'27.3.4.19'}  | ${'28.0.0.0'}   | ${true}
    ${'27.3.4.19'}  | ${'26.0.0.0'}   | ${true}
    ${'1.0.0-rc.1'} | ${'1.0.0'}      | ${true}
    ${'1.0.0'}      | ${'1.0.1-rc.1'} | ${true}
    ${'foo'}        | ${'1.0.0'}      | ${true}
  `(
    'isBreaking("$current", "$version") === $expected',
    ({ current, version, expected }) => {
      expect(semverExtended.isBreaking?.(current, version)).toBe(expected);
    },
  );

  it.each`
    currentValue  | currentVersion | newVersion    | expected
    ${'1.2.3.4'}  | ${'1.2.3.4'}   | ${'1.2.3.5'}  | ${'1.2.3.5'}
    ${'v1.2.3.4'} | ${'v1.2.3.4'}  | ${'v1.2.3.5'} | ${'v1.2.3.5'}
    ${'1.2.3.4'}  | ${'v1.2.3.4'}  | ${'v1.2.3.5'} | ${'1.2.3.5'}
  `(
    'getNewValue("$currentValue", "$currentVersion", "$newVersion") === "$expected"',
    ({ currentValue, currentVersion, newVersion, expected }) => {
      expect(
        semverExtended.getNewValue({
          currentValue,
          rangeStrategy: 'replace',
          currentVersion,
          newVersion,
        }),
      ).toBe(expected);
    },
  );
});
