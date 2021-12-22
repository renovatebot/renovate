import { api as semverRuby } from '.';

describe('versioning/ruby/index', () => {
  test.each`
    a              | b              | expected
    ${'1.0.0'}     | ${'1'}         | ${true}
    ${'1.2.0'}     | ${'1.2'}       | ${true}
    ${'1.2.0'}     | ${'1.2.0'}     | ${true}
    ${'1.0.0.rc1'} | ${'1.0.0.rc1'} | ${true}
    ${'1.2.0'}     | ${'2'}         | ${false}
    ${'1.2.0'}     | ${'1.1'}       | ${false}
    ${'1.2.0'}     | ${'1.2.1'}     | ${false}
    ${'1.0.0.rc1'} | ${'1.0.0.rc2'} | ${false}
  `('equals("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(semverRuby.equals(a, b)).toBe(expected);
  });

  test.each`
    version            | major | minor   | patch
    ${'1'}             | ${1}  | ${null} | ${null}
    ${'1.2'}           | ${1}  | ${2}    | ${null}
    ${'1.2.0'}         | ${1}  | ${2}    | ${0}
    ${'1.2.0.alpha.4'} | ${1}  | ${2}    | ${0}
  `(
    'getMajor, getMinor, getPatch for "$version"',
    ({ version, major, minor, patch }) => {
      expect(semverRuby.getMajor(version)).toBe(major);
      expect(semverRuby.getMinor(version)).toBe(minor);
      expect(semverRuby.getPatch(version)).toBe(patch);
    }
  );

  test.each`
    version                     | expected
    ${'0'}                      | ${true}
    ${'v0'}                     | ${true}
    ${'v1'}                     | ${true}
    ${'v1.2'}                   | ${true}
    ${'v1.2.3'}                 | ${true}
    ${'1'}                      | ${true}
    ${'1.1'}                    | ${true}
    ${'1.1.2'}                  | ${true}
    ${'1.1.2.3'}                | ${true}
    ${'1.1.2-4'}                | ${true}
    ${'1.1.2.pre.4'}            | ${true}
    ${'v1.1.2.pre.4'}           | ${true}
    ${undefined}                | ${false}
    ${''}                       | ${false}
    ${null}                     | ${false}
    ${'v'}                      | ${false}
    ${'tottally-not-a-version'} | ${false}
  `('isVersion("$version") === $expected', ({ version, expected }) => {
    expect(!!semverRuby.isVersion(version)).toBe(expected);
  });

  test.each`
    a                 | b                 | expected
    ${'2'}            | ${'1'}            | ${true}
    ${'2.2'}          | ${'2.1'}          | ${true}
    ${'2.2.1'}        | ${'2.2.0'}        | ${true}
    ${'3.0.0.rc2'}    | ${'3.0.0.rc1'}    | ${true}
    ${'3.0.0-rc.2'}   | ${'3.0.0-rc.1'}   | ${true}
    ${'3.0.0.rc1'}    | ${'3.0.0.beta'}   | ${true}
    ${'3.0.0-rc.1'}   | ${'3.0.0-beta'}   | ${true}
    ${'3.0.0.beta'}   | ${'3.0.0.alpha'}  | ${true}
    ${'3.0.0-beta'}   | ${'3.0.0-alpha'}  | ${true}
    ${'5.0.1.rc1'}    | ${'5.0.1.beta1'}  | ${true}
    ${'5.0.1-rc.1'}   | ${'5.0.1-beta.1'} | ${true}
    ${'1'}            | ${'2'}            | ${false}
    ${'2.1'}          | ${'2.2'}          | ${false}
    ${'2.2.0'}        | ${'2.2.1'}        | ${false}
    ${'3.0.0.rc1'}    | ${'3.0.0.rc2'}    | ${false}
    ${'3.0.0-rc.1'}   | ${'3.0.0-rc.2'}   | ${false}
    ${'3.0.0.beta'}   | ${'3.0.0.rc1'}    | ${false}
    ${'3.0.0-beta'}   | ${'3.0.0-rc.1'}   | ${false}
    ${'3.0.0.alpha'}  | ${'3.0.0.beta'}   | ${false}
    ${'3.0.0-alpha'}  | ${'3.0.0-beta'}   | ${false}
    ${'5.0.1.beta1'}  | ${'5.0.1.rc1'}    | ${false}
    ${'5.0.1-beta.1'} | ${'5.0.1-rc.1'}   | ${false}
    ${'1'}            | ${'1'}            | ${false}
    ${'2.1'}          | ${'2.1'}          | ${false}
    ${'2.2.0'}        | ${'2.2.0'}        | ${false}
    ${'3.0.0.rc1'}    | ${'3.0.0.rc1'}    | ${false}
    ${'3.0.0-rc.1'}   | ${'3.0.0-rc.1'}   | ${false}
    ${'3.0.0.beta'}   | ${'3.0.0.beta'}   | ${false}
    ${'3.0.0-beta'}   | ${'3.0.0-beta'}   | ${false}
    ${'3.0.0.alpha'}  | ${'3.0.0.alpha'}  | ${false}
    ${'3.0.0-alpha'}  | ${'3.0.0-alpha'}  | ${false}
    ${'5.0.1.beta1'}  | ${'5.0.1.beta1'}  | ${false}
    ${'5.0.1-beta.1'} | ${'5.0.1-beta.1'} | ${false}
  `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(semverRuby.isGreaterThan(a, b)).toBe(expected);
  });

  test.each`
    version                     | expected
    ${'1'}                      | ${true}
    ${'1.2'}                    | ${true}
    ${'1.2.3'}                  | ${true}
    ${'1.2.0-alpha'}            | ${false}
    ${'1.2.0.alpha'}            | ${false}
    ${'1.2.0.alpha1'}           | ${false}
    ${'1.2.0-alpha.1'}          | ${false}
    ${undefined}                | ${false}
    ${''}                       | ${false}
    ${null}                     | ${false}
    ${'tottally-not-a-version'} | ${false}
  `('isStable("$version") === $expected', ({ version, expected }) => {
    const res = !!semverRuby.isStable(version);
    expect(res).toBe(expected);
  });

  test.each`
    versions                                     | expected
    ${['1.2.3-beta', '2.0.1', '1.3.4', '1.2.3']} | ${['1.2.3-beta', '1.2.3', '1.3.4', '2.0.1']}
  `('$versions -> sortVersions -> $expected ', ({ versions, expected }) => {
    expect(versions.sort(semverRuby.sortVersions)).toEqual(expected);
  });

  test.each`
    versions                                                          | range                 | expected
    ${['2.1.5', '2.1.6']}                                             | ${'~> 2.1'}           | ${'2.1.5'}
    ${['2.1.6', '2.1.5']}                                             | ${'~> 2.1.6'}         | ${'2.1.6'}
    ${['4.7.3', '4.7.4', '4.7.5', '4.7.9']}                           | ${'~> 4.7, >= 4.7.4'} | ${'4.7.4'}
    ${['2.5.3', '2.5.4', '2.5.5', '2.5.6']}                           | ${'~>2.5.3'}          | ${'2.5.3'}
    ${['2.1.0', '3.0.0.beta', '2.3', '3.0.0-rc.1', '3.0.0', '3.1.1']} | ${'~> 3.0'}           | ${'3.0.0'}
    ${['1.2.3', '1.2.4']}                                             | ${'>= 3.5.0'}         | ${null}
  `(
    'minSatisfyingVersion($versions, "$range") === "$expected"',
    ({ versions, range, expected }) => {
      expect(semverRuby.minSatisfyingVersion(versions, range)).toBe(expected);
    }
  );

  test.each`
    versions                                                          | range                 | expected
    ${['2.1.5', '2.1.6']}                                             | ${'~> 2.1'}           | ${'2.1.6'}
    ${['2.1.6', '2.1.5']}                                             | ${'~> 2.1.6'}         | ${'2.1.6'}
    ${['4.7.3', '4.7.4', '4.7.5', '4.7.9']}                           | ${'~> 4.7, >= 4.7.4'} | ${'4.7.9'}
    ${['2.5.3', '2.5.4', '2.5.5', '2.5.6']}                           | ${'~>2.5.3'}          | ${'2.5.6'}
    ${['2.1.0', '3.0.0.beta', '2.3', '3.0.0-rc.1', '3.0.0', '3.1.1']} | ${'~> 3.0'}           | ${'3.1.1'}
    ${['1.2.3', '1.2.4']}                                             | ${'>= 3.5.0'}         | ${null}
  `(
    'getSatisfyingVersion($versions, "$range") === "$expected"',
    ({ versions, range, expected }) => {
      expect(semverRuby.getSatisfyingVersion(versions, range)).toBe(expected);
    }
  );

  test.each`
    version    | range                | expected
    ${'1.2'}   | ${'>= 1.2'}          | ${true}
    ${'1.2.3'} | ${'~> 1.2.1'}        | ${true}
    ${'1.2.7'} | ${'1.2.7'}           | ${true}
    ${'1.1.6'} | ${'>= 1.1.5, < 2.0'} | ${true}
    ${'1.2'}   | ${'>= 1.3'}          | ${false}
    ${'1.3.8'} | ${'~> 1.2.1'}        | ${false}
    ${'1.3.9'} | ${'1.3.8'}           | ${false}
    ${'2.0.0'} | ${'>= 1.1.5, < 2.0'} | ${false}
  `(
    'matches("$version", "$range") === "$expected"',
    ({ version, range, expected }) => {
      expect(semverRuby.matches(version, range)).toBe(expected);
    }
  );

  test.each`
    version          | range                  | expected
    ${'1.2.2'}       | ${'< 1.2.2'}           | ${true}
    ${'1.1.4'}       | ${'>= 1.1.5, < 2.0'}   | ${true}
    ${'1.2.0-alpha'} | ${'1.2.0-beta'}        | ${true}
    ${'1.2.2'}       | ${'> 1.2.2, ~> 2.0.0'} | ${true}
    ${'1.2.2'}       | ${'<= 1.2.2'}          | ${false}
    ${'2.0.0'}       | ${'>= 1.1.5, < 2.0'}   | ${false}
    ${'1.2.0-beta'}  | ${'1.2.0-alpha'}       | ${false}
    ${'2.0.0'}       | ${'> 1.2.2, ~> 2.0.0'} | ${false}
    ${'asdf'}        | ${'> 1.2.2, ~> 2.0.0'} | ${null}
    ${null}          | ${'> 1.2.2, ~> 2.0.0'} | ${null}
  `(
    'isLessThanRange("$version", "$range") === "$expected"',
    ({ version, range, expected }) => {
      expect(semverRuby.isLessThanRange?.(version, range)).toBe(expected);
    }
  );

  test.each`
    version                                | expected
    ${'1'}                                 | ${true}
    ${'1.2'}                               | ${true}
    ${'1.2.3'}                             | ${true}
    ${'^1.2.3'}                            | ${false}
    ${'~1.2.3'}                            | ${false}
    ${'1.2.*'}                             | ${false}
    ${'< 3.0, >= 1.0.0 <= 2.0.0'}          | ${false}
    ${'< 3.0, >= 1.0.0 <= 2.0.0, = 5.1.2'} | ${false}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(!!semverRuby.isValid(version)).toBe(expected);
  });

  test.each`
    version               | expected
    ${'1'}                | ${true}
    ${'1.1'}              | ${true}
    ${'1.1.2'}            | ${true}
    ${'1.2.0.alpha1'}     | ${true}
    ${'1.2.0-alpha.1'}    | ${true}
    ${'= 1'}              | ${true}
    ${'!= 1.1'}           | ${true}
    ${'> 1.1.2'}          | ${true}
    ${'< 1.0.0-beta'}     | ${true}
    ${'>= 1.0.0.beta'}    | ${true}
    ${'<= 1.2.0.alpha1'}  | ${true}
    ${'~> 1.2.0-alpha.1'} | ${true}
    ${'>= 3.0.5, < 3.2'}  | ${true}
    ${'+ 1'}              | ${false}
    ${'- 1.1'}            | ${false}
    ${'=== 1.1.2'}        | ${false}
    ${'! 1.0.0-beta'}     | ${false}
    ${'& 1.0.0.beta'}     | ${false}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(!!semverRuby.isValid(version)).toBe(expected);
  });

  test.each`
    version                     | expected
    ${'1'}                      | ${true}
    ${'1.2'}                    | ${true}
    ${'1.2.1'}                  | ${true}
    ${'=1'}                     | ${true}
    ${'=1.2'}                   | ${true}
    ${'=1.2.1'}                 | ${true}
    ${'= 1'}                    | ${true}
    ${'= 1.2'}                  | ${true}
    ${'= 1.2.1'}                | ${true}
    ${'1.2.1.rc1'}              | ${true}
    ${'1.2.1-rc.1'}             | ${true}
    ${'= 1.2.0.alpha'}          | ${true}
    ${'= 1.2.0-alpha'}          | ${true}
    ${'!= 1'}                   | ${false}
    ${'> 1.2'}                  | ${false}
    ${'< 1.2.1'}                | ${false}
    ${'>= 1'}                   | ${false}
    ${'<= 1.2'}                 | ${false}
    ${'~> 1.2.1'}               | ${false}
    ${undefined}                | ${false}
    ${''}                       | ${false}
    ${null}                     | ${false}
    ${'tottally-not-a-version'} | ${false}
  `('isSingleVersion("$version") === $expected', ({ version, expected }) => {
    expect(!!semverRuby.isSingleVersion(version)).toBe(expected);
  });

  test.each`
    currentValue             | rangeStrategy        | currentVersion | newVersion   | expected
    ${'1.0.3'}               | ${'pin'}             | ${'1.0.3'}     | ${'1.2.3'}   | ${'1.2.3'}
    ${'v1.0.3'}              | ${'pin'}             | ${'1.0.3'}     | ${'1.2.3'}   | ${'v1.2.3'}
    ${'= 1.0.3'}             | ${'pin'}             | ${'1.0.3'}     | ${'1.2.3'}   | ${'= 1.2.3'}
    ${'!= 1.0.3'}            | ${'pin'}             | ${'1.0.4'}     | ${'1.2.3'}   | ${'1.2.3'}
    ${'> 1.0.3'}             | ${'pin'}             | ${'1.0.4'}     | ${'1.2.3'}   | ${'1.2.3'}
    ${'< 1.0.3'}             | ${'pin'}             | ${'1.0.2'}     | ${'1.2.3'}   | ${'1.2.3'}
    ${'>= 1.0.3'}            | ${'pin'}             | ${'1.0.4'}     | ${'1.2.3'}   | ${'1.2.3'}
    ${'<= 1.0.3'}            | ${'pin'}             | ${'1.0.3'}     | ${'1.2.3'}   | ${'1.2.3'}
    ${'~> 1.0.3'}            | ${'pin'}             | ${'1.0.4'}     | ${'1.2.3'}   | ${'1.2.3'}
    ${'~> 4.7, >= 4.7.4'}    | ${'pin'}             | ${'4.7.5'}     | ${'4.7.8'}   | ${'4.7.8'}
    ${"'>= 3.0.5', '< 3.2'"} | ${'replace'}         | ${'3.1.5'}     | ${'3.2.1'}   | ${"'>= 3.0.5', '< 3.3'"}
    ${"'0.0.10'"}            | ${'auto'}            | ${'0.0.10'}    | ${'0.0.11'}  | ${"'0.0.11'"}
    ${"'0.0.10'"}            | ${'replace'}         | ${'0.0.10'}    | ${'0.0.11'}  | ${"'0.0.11'"}
    ${'1.0.3'}               | ${'bump'}            | ${'1.0.3'}     | ${'1.2.3'}   | ${'1.2.3'}
    ${'v1.0.3'}              | ${'bump'}            | ${'1.0.3'}     | ${'1.2.3'}   | ${'v1.2.3'}
    ${'= 1.0.3'}             | ${'bump'}            | ${'1.0.3'}     | ${'1.2.3'}   | ${'= 1.2.3'}
    ${'!= 1.0.3'}            | ${'bump'}            | ${'1.0.0'}     | ${'1.2.3'}   | ${'!= 1.0.3'}
    ${'> 1.0.3'}             | ${'bump'}            | ${'1.0.4'}     | ${'1.2.3'}   | ${'> 1.2.2'}
    ${'> 1.2.3'}             | ${'bump'}            | ${'1.0.0'}     | ${'1.0.3'}   | ${'> 1.2.3'}
    ${'< 1.0.3'}             | ${'bump'}            | ${'1.0.0'}     | ${'1.2.3'}   | ${'< 1.2.4'}
    ${'< 1.2.3'}             | ${'bump'}            | ${'1.0.0'}     | ${'1.0.3'}   | ${'< 1.2.3'}
    ${'< 1.2.2'}             | ${'bump'}            | ${'1.0.0'}     | ${'1.2.3'}   | ${'< 1.2.4'}
    ${'< 1.2.3'}             | ${'bump'}            | ${'1.0.0'}     | ${'1.2.3'}   | ${'< 1.2.4'}
    ${'< 1.2'}               | ${'bump'}            | ${'1.0.0'}     | ${'1.2.3'}   | ${'< 1.3'}
    ${'< 1'}                 | ${'bump'}            | ${'0.9.0'}     | ${'1.2.3'}   | ${'< 2'}
    ${'>= 1.0.3'}            | ${'bump'}            | ${'1.0.3'}     | ${'1.2.3'}   | ${'>= 1.2.3'}
    ${'<= 1.0.3'}            | ${'bump'}            | ${'1.0.3'}     | ${'1.2.3'}   | ${'<= 1.2.3'}
    ${'~> 1.0.3'}            | ${'bump'}            | ${'1.0.3'}     | ${'1.2.3'}   | ${'~> 1.2.0'}
    ${'~> 1.0.3'}            | ${'bump'}            | ${'1.0.3'}     | ${'1.0.4'}   | ${'~> 1.0.0'}
    ${'~> 4.7, >= 4.7.4'}    | ${'bump'}            | ${'4.7.5'}     | ${'4.7.9'}   | ${'~> 4.7.0, >= 4.7.9'}
    ${'>= 3.2, < 5.0'}       | ${'replace'}         | ${'4.0.2'}     | ${'6.0.1'}   | ${'>= 3.2, < 6.0.2'}
    ${'~> 5.2, >= 5.2.5'}    | ${'replace'}         | ${'5.3.0'}     | ${'6.0.1'}   | ${'~> 6.0, >= 6.0.1'}
    ${'~> 5.2.0, >= 5.2.5'}  | ${'replace'}         | ${'5.2.5'}     | ${'5.3.1'}   | ${'~> 5.3.0, >= 5.3.1'}
    ${'4.2.0'}               | ${'replace'}         | ${'4.2.0'}     | ${'4.2.5.1'} | ${'4.2.5.1'}
    ${'4.2.5.1'}             | ${'replace'}         | ${'0.1'}       | ${'4.3.0'}   | ${'4.3.0'}
    ${'~> 1'}                | ${'replace'}         | ${'1.2.0'}     | ${'2.0.3'}   | ${'~> 2'}
    ${'= 5.2.2'}             | ${'replace'}         | ${'5.2.2'}     | ${'5.2.2.1'} | ${'= 5.2.2.1'}
    ${'1.0.3'}               | ${'replace'}         | ${'1.0.3'}     | ${'1.2.3'}   | ${'1.2.3'}
    ${'v1.0.3'}              | ${'replace'}         | ${'1.0.3'}     | ${'1.2.3'}   | ${'v1.2.3'}
    ${'= 1.0.3'}             | ${'replace'}         | ${'1.0.3'}     | ${'1.2.3'}   | ${'= 1.2.3'}
    ${'!= 1.0.3'}            | ${'replace'}         | ${'1.0.0'}     | ${'1.2.3'}   | ${'!= 1.0.3'}
    ${'< 1.0.3'}             | ${'replace'}         | ${'1.0.0'}     | ${'1.2.3'}   | ${'< 1.2.4'}
    ${'< 1.2.2'}             | ${'replace'}         | ${'1.0.0'}     | ${'1.2.3'}   | ${'< 1.2.4'}
    ${'< 1.2.3'}             | ${'replace'}         | ${'1.0.0'}     | ${'1.2.3'}   | ${'< 1.2.4'}
    ${'< 1.2'}               | ${'replace'}         | ${'1.0.0'}     | ${'1.2.3'}   | ${'< 1.3'}
    ${'< 1'}                 | ${'replace'}         | ${'0.9.0'}     | ${'1.2.3'}   | ${'< 2'}
    ${'< 1.2.3'}             | ${'replace'}         | ${'1.0.0'}     | ${'1.2.2'}   | ${'< 1.2.3'}
    ${'>= 1.0.3'}            | ${'replace'}         | ${'1.0.3'}     | ${'1.2.3'}   | ${'>= 1.0.3'}
    ${'<= 1.0.3'}            | ${'replace'}         | ${'1.0.0'}     | ${'1.2.3'}   | ${'<= 1.2.3'}
    ${'<= 1.0.3'}            | ${'replace'}         | ${'1.0.0'}     | ${'1.0.2'}   | ${'<= 1.0.3'}
    ${'~> 1.0.3'}            | ${'replace'}         | ${'1.0.0'}     | ${'1.2.3'}   | ${'~> 1.2.0'}
    ${'~> 1.0.3'}            | ${'replace'}         | ${'1.0.0'}     | ${'1.0.4'}   | ${'~> 1.0.3'}
    ${'~> 4.7, >= 4.7.4'}    | ${'replace'}         | ${'1.0.0'}     | ${'4.7.9'}   | ${'~> 4.7, >= 4.7.4'}
    ${'>= 2.0.0, <= 2.15'}   | ${'replace'}         | ${'2.15.0'}    | ${'2.20.1'}  | ${'>= 2.0.0, <= 2.20.1'}
    ${'~> 5.2.0'}            | ${'replace'}         | ${'5.2.4.1'}   | ${'6.0.2.1'} | ${'~> 6.0.0'}
    ${'~> 4.0, < 5'}         | ${'replace'}         | ${'4.7.5'}     | ${'5.0.0'}   | ${'~> 5.0, < 6'}
    ${'~> 4.0, < 5'}         | ${'replace'}         | ${'4.7.5'}     | ${'5.0.1'}   | ${'~> 5.0, < 6'}
    ${'~> 4.0, < 5'}         | ${'replace'}         | ${'4.7.5'}     | ${'5.1.0'}   | ${'~> 5.1, < 6'}
    ${'< 1.0.3'}             | ${'auto'}            | ${'1.0.3'}     | ${'1.2.4'}   | ${'< 1.2.5'}
    ${'< 1.0.3'}             | ${'replace'}         | ${'1.0.3'}     | ${'1.2.4'}   | ${'< 1.2.5'}
    ${'< 1.0.3'}             | ${'widen'}           | ${'1.0.3'}     | ${'1.2.4'}   | ${'< 1.2.5'}
    ${'< 1.0.3'}             | ${'replace'}         | ${'1.0.3'}     | ${'1.2.4'}   | ${'< 1.2.5'}
    ${'~> 6.0.0'}            | ${'update-lockfile'} | ${'6.0.2'}     | ${'6.0.3'}   | ${'~> 6.0.0'}
    ${'~> 6.0.0'}            | ${'update-lockfile'} | ${'6.0.2'}     | ${'7.0.0'}   | ${'~> 7.0.0'}
  `(
    'getNewValue("$currentValue", "$rangeStrategy", "$currentVersion", "$newVersion") === "$expected"',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      expect(
        semverRuby.getNewValue({
          currentValue,
          rangeStrategy,
          currentVersion,
          newVersion,
        })
      ).toBe(expected);
    }
  );
});
