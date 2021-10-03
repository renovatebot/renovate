import { api as versioning } from '.';

describe('versioning/poetry/index', () => {
  describe('equals', () => {
    test.each`
      a             | b        | expected
      ${'1'}        | ${'1'}   | ${true}
      ${'1.0'}      | ${'1'}   | ${true}
      ${'1.0.0'}    | ${'1'}   | ${true}
      ${'1.9.0'}    | ${'1.9'} | ${true}
      ${'1'}        | ${'2'}   | ${false}
      ${'1.9.1'}    | ${'1.9'} | ${false}
      ${'1.9-beta'} | ${'1.9'} | ${false}
    `('equals("$a", "$b") === $expected', ({ a, b, expected }) => {
      expect(versioning.equals(a, b)).toBe(expected);
    });
  });

  test.each`
    version    | major | minor | patch
    ${'1'}     | ${1}  | ${0}  | ${0}
    ${'1.9'}   | ${1}  | ${9}  | ${0}
    ${'1.9.0'} | ${1}  | ${9}  | ${0}
    ${'1.9.4'} | ${1}  | ${9}  | ${4}
  `(
    'getMajor, getMinor, getPatch for "$version"',
    ({ version, major, minor, patch }) => {
      expect(versioning.getMajor(version)).toBe(major);
      expect(versioning.getMinor(version)).toBe(minor);
      expect(versioning.getPatch(version)).toBe(patch);
    }
  );

  test.each`
    a           | b             | expected
    ${'2'}      | ${'1'}        | ${true}
    ${'2.0'}    | ${'1'}        | ${true}
    ${'2.0.0'}  | ${'1'}        | ${true}
    ${'1.10.0'} | ${'1.9'}      | ${true}
    ${'1.9'}    | ${'1.9-beta'} | ${true}
    ${'1'}      | ${'1'}        | ${false}
    ${'1.0'}    | ${'1'}        | ${false}
    ${'1.0.0'}  | ${'1'}        | ${false}
    ${'1.9.0'}  | ${'1.9'}      | ${false}
  `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(versioning.isGreaterThan(a, b)).toBe(expected);
  });

  test.each`
    version         | expected
    ${'1'}          | ${true}
    ${'1.9'}        | ${true}
    ${'1.9.0'}      | ${true}
    ${'1.9.4'}      | ${true}
    ${'1.9.4-beta'} | ${false}
  `('isStable("$version") === $expected', ({ version, expected }) => {
    const res = !!versioning.isStable(version);
    expect(res).toBe(expected);
  });

  test.each`
    version                                          | expected
    ${'17.04.0'}                                     | ${false}
    ${'1.2.3'}                                       | ${true}
    ${'1.2.3-foo'}                                   | ${true}
    ${'1.2.3foo'}                                    | ${false}
    ${'*'}                                           | ${true}
    ${'~1.2.3'}                                      | ${true}
    ${'^1.2.3'}                                      | ${true}
    ${'>1.2.3'}                                      | ${true}
    ${'renovatebot/renovate'}                        | ${false}
    ${'renovatebot/renovate#master'}                 | ${false}
    ${'https://github.com/renovatebot/renovate.git'} | ${false}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(!!versioning.isValid(version)).toBe(expected);
  });

  test.each`
    version            | expected
    ${'1.2.3'}         | ${true}
    ${'1.2.3-alpha.1'} | ${true}
    ${'=1.2.3'}        | ${true}
    ${'= 1.2.3'}       | ${true}
    ${'1.*'}           | ${false}
  `('isSingleVersion("$version") === $expected', ({ version, expected }) => {
    expect(!!versioning.isSingleVersion(version)).toBe(expected);
  });

  test.each`
    version    | range                     | expected
    ${'4.2.0'} | ${'4.2, >= 3.0, < 5.0.0'} | ${true}
    ${'4.2.0'} | ${'2.0, >= 3.0, < 5.0.0'} | ${false}
    ${'4.2.2'} | ${'4.2.0, < 4.2.4'}       | ${false}
    ${'4.2.2'} | ${'^4.2.0, < 4.2.4'}      | ${true}
    ${'4.2.0'} | ${'4.3.0, 3.0.0'}         | ${false}
    ${'4.2.0'} | ${'> 5.0.0, <= 6.0.0'}    | ${false}
    ${'4.2.0'} | ${'*'}                    | ${true}
    ${'1.4'}   | ${'1.4'}                  | ${true}
  `(
    'matches("$version", "$range") === "$expected"',
    ({ version, range, expected }) => {
      expect(versioning.matches(version, range)).toBe(expected);
    }
  );

  test.each`
    version    | range                  | expected
    ${'0.9.0'} | ${'>= 1.0.0 <= 2.0.0'} | ${true}
    ${'1.9.0'} | ${'>= 1.0.0 <= 2.0.0'} | ${false}
  `(
    'isLessThanRange("$version", "$range") === "$expected"',
    ({ version, range, expected }) => {
      expect(versioning.isLessThanRange(version, range)).toBe(expected);
    }
  );

  test.each`
    versions                                         | range                          | expected
    ${['0.4.0', '0.5.0', '4.2.0', '4.3.0', '5.0.0']} | ${'4.*, > 4.2'}                | ${'4.3.0'}
    ${['0.4.0', '0.5.0', '4.2.0', '5.0.0']}          | ${'^4.0.0'}                    | ${'4.2.0'}
    ${['0.4.0', '0.5.0', '4.2.0', '5.0.0']}          | ${'^4.0.0, = 0.5.0'}           | ${null}
    ${['0.4.0', '0.5.0', '4.2.0', '5.0.0']}          | ${'^4.0.0, > 4.1.0, <= 4.3.5'} | ${'4.2.0'}
    ${['0.4.0', '0.5.0', '4.2.0', '5.0.0']}          | ${'^6.2.0, 3.*'}               | ${null}
  `(
    'minSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(versioning.minSatisfyingVersion(versions, range)).toBe(expected);
    }
  );

  test.each`
    versions                                                  | range               | expected
    ${['4.2.1', '0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0']} | ${'4.*.0, < 4.2.5'} | ${'4.2.1'}
    ${['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0', '5.0.3']} | ${'5.0, > 5.0.0'}   | ${'5.0.3'}
  `(
    'getSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(versioning.getSatisfyingVersion(versions, range)).toBe(expected);
    }
  );
  test.each`
    currentValue     | rangeStrategy | currentVersion | newVersion              | expected
    ${'1.0.0'}       | ${'bump'}     | ${'1.0.0'}     | ${'1.1.0'}              | ${'1.1.0'}
    ${'   1.0.0'}    | ${'bump'}     | ${'1.0.0'}     | ${'1.1.0'}              | ${'1.1.0'}
    ${'1.0.0'}       | ${'bump'}     | ${'1.0.0'}     | ${'1.1.0'}              | ${'1.1.0'}
    ${'=1.0.0'}      | ${'bump'}     | ${'1.0.0'}     | ${'1.1.0'}              | ${'=1.1.0'}
    ${'=  1.0.0'}    | ${'bump'}     | ${'1.0.0'}     | ${'1.1.0'}              | ${'=1.1.0'}
    ${'= 1.0.0'}     | ${'bump'}     | ${'1.0.0'}     | ${'1.1.0'}              | ${'=1.1.0'}
    ${'  = 1.0.0'}   | ${'bump'}     | ${'1.0.0'}     | ${'1.1.0'}              | ${'=1.1.0'}
    ${'  =   1.0.0'} | ${'bump'}     | ${'1.0.0'}     | ${'1.1.0'}              | ${'=1.1.0'}
    ${'=    1.0.0'}  | ${'bump'}     | ${'1.0.0'}     | ${'1.1.0'}              | ${'=1.1.0'}
    ${'^1.0'}        | ${'bump'}     | ${'1.0.0'}     | ${'1.0.7'}              | ${'^1.0'}
    ${'^1.0.0'}      | ${'replace'}  | ${'1.0.0'}     | ${'2.0.7'}              | ${'^2.0.0'}
    ${'^5.0.3'}      | ${'replace'}  | ${'5.3.1'}     | ${'5.5'}                | ${'^5.0.3'}
    ${'1.0.0'}       | ${'replace'}  | ${'1.0.0'}     | ${'2.0.7'}              | ${'2.0.7'}
    ${'^1.0.0'}      | ${'replace'}  | ${'1.0.0'}     | ${'2.0.7'}              | ${'^2.0.0'}
    ${'^0.5.15'}     | ${'replace'}  | ${'0.5.15'}    | ${'0.6'}                | ${'^0.5.15'}
    ${'^1'}          | ${'bump'}     | ${'1.0.0'}     | ${'2.1.7'}              | ${'^2'}
    ${'~1'}          | ${'bump'}     | ${'1.0.0'}     | ${'1.1.7'}              | ${'~1'}
    ${'5'}           | ${'bump'}     | ${'5.0.0'}     | ${'5.1.7'}              | ${'5'}
    ${'5'}           | ${'bump'}     | ${'5.0.0'}     | ${'6.1.7'}              | ${'6'}
    ${'5.0'}         | ${'bump'}     | ${'5.0.0'}     | ${'5.0.7'}              | ${'5.0'}
    ${'5.0'}         | ${'bump'}     | ${'5.0.0'}     | ${'5.1.7'}              | ${'5.1'}
    ${'5.0'}         | ${'bump'}     | ${'5.0.0'}     | ${'6.1.7'}              | ${'6.1'}
    ${'5.0'}         | ${'replace'}  | ${'5.0.0'}     | ${'6.1.7'}              | ${'6.1'}
    ${'=1.0.0'}      | ${'replace'}  | ${'1.0.0'}     | ${'1.1.0'}              | ${'=1.1.0'}
    ${'^1'}          | ${'bump'}     | ${'1.0.0'}     | ${'1.0.7-prerelease.1'} | ${'^1.0.7-prerelease.1'}
    ${'^1.0.0'}      | ${'replace'}  | ${'1.0.0'}     | ${'1.2.3'}              | ${'^1.0.0'}
    ${'~1.0'}        | ${'bump'}     | ${'1.0.0'}     | ${'1.1.7'}              | ${'~1.1'}
    ${'1.0.*'}       | ${'replace'}  | ${'1.0.0'}     | ${'1.1.0'}              | ${'1.1.*'}
    ${'1.*'}         | ${'replace'}  | ${'1.0.0'}     | ${'2.1.0'}              | ${'2.*'}
    ${'~0.6.1'}      | ${'replace'}  | ${'0.6.8'}     | ${'0.7.0-rc.2'}         | ${'~0.7.0-rc'}
    ${'<1.3.4'}      | ${'replace'}  | ${'1.2.3'}     | ${'1.5.0'}              | ${'<1.5.1'}
    ${'< 1.3.4'}     | ${'replace'}  | ${'1.2.3'}     | ${'1.5.0'}              | ${'< 1.5.1'}
    ${'<   1.3.4'}   | ${'replace'}  | ${'1.2.3'}     | ${'1.5.0'}              | ${'< 1.5.1'}
    ${'<=1.3.4'}     | ${'replace'}  | ${'1.2.3'}     | ${'1.5.0'}              | ${'<=1.5.0'}
    ${'<= 1.3.4'}    | ${'replace'}  | ${'1.2.3'}     | ${'1.5.0'}              | ${'<= 1.5.0'}
    ${'<=   1.3.4'}  | ${'replace'}  | ${'1.2.3'}     | ${'1.5.0'}              | ${'<= 1.5.0'}
    ${'^1.2'}        | ${'replace'}  | ${'1.2.3'}     | ${'2.0.0'}              | ${'^2.0'}
    ${'^1'}          | ${'replace'}  | ${'1.2.3'}     | ${'2.0.0'}              | ${'^2'}
    ${'~1.2'}        | ${'replace'}  | ${'1.2.3'}     | ${'2.0.0'}              | ${'~2.0'}
    ${'~1'}          | ${'replace'}  | ${'1.2.3'}     | ${'2.0.0'}              | ${'~2'}
    ${'^2.2'}        | ${'widen'}    | ${'2.2.0'}     | ${'3.0.0'}              | ${'^2.2 || ^3.0.0'}
  `(
    'getNewValue("$currentValue", "$rangeStrategy", "$currentVersion", "$newVersion") === "$expected"',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      const res = versioning.getNewValue({
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
      });
      expect(res).toEqual(expected);
    }
  );

  test.each`
    a           | b             | expected
    ${'2'}      | ${'1'}        | ${1}
    ${'2.0'}    | ${'1'}        | ${1}
    ${'2.0.0'}  | ${'1'}        | ${1}
    ${'1.10.0'} | ${'1.9'}      | ${1}
    ${'1.9'}    | ${'1.9-beta'} | ${1}
    ${'1'}      | ${'1'}        | ${0}
    ${'1.0'}    | ${'1'}        | ${0}
    ${'1.0.0'}  | ${'1'}        | ${0}
    ${'1.9.0'}  | ${'1.9'}      | ${0}
  `('sortVersions("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(versioning.sortVersions(a, b)).toEqual(expected);
  });
});
