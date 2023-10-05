import ociHelm from '.';

describe('modules/versioning/oci-helm/index', () => {
  it.each`
    version                              | expected
    ${null}                              | ${false}
    ${''}                                | ${false}
    ${'1.2.3'}                           | ${true}
    ${'v1.2.3'}                          | ${true}
    ${'1.02.3'}                          | ${true}
    ${'3'}                               | ${true}
    ${'0.1.1-1686130589_build1-7aebcdf'} | ${true}
    ${'0.1.1-1686130589+main'}           | ${true}
    ${'foo'}                             | ${false}
    ${'12.23.4.1234'}                    | ${false}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    const res = ociHelm.isValid(version);
    expect(!!res).toBe(expected);
  });

  it.each`
    version                              | expected
    ${null}                              | ${false}
    ${''}                                | ${false}
    ${'1.2.3'}                           | ${true}
    ${'v1.2.3'}                          | ${true}
    ${'3'}                               | ${false}
    ${'0.1.1-1686130589_build1-7aebcdf'} | ${true}
    ${'0.1.1-1686130589+build1-7aebcdf'} | ${true}
    ${'1.2.3-1686130589'}                | ${true}
    ${'foo'}                             | ${false}
    ${'12.23.4.1234'}                    | ${false}
  `('isVersion("$version") === $expected', ({ version, expected }) => {
    const res = ociHelm.isVersion(version);
    expect(!!res).toBe(expected);
  });

  it.each`
    version                               | major   | minor   | patch
    ${'1.2.3'}                            | ${1}    | ${2}    | ${3}
    ${'18.04'}                            | ${18}   | ${4}    | ${null}
    ${'10.1'}                             | ${10}   | ${1}    | ${null}
    ${'3'}                                | ${3}    | ${null} | ${null}
    ${'foo'}                              | ${null} | ${null} | ${null}
    ${'0.1.2-1686130589_build1-7aebcdf'}  | ${0}    | ${1}    | ${2}
    ${'1-1686130589_build1-7aebcdf'}      | ${0}    | ${null} | ${null}
    ${'0.1.2-1686130589+build1-7aebcdf'}  | ${0}    | ${1}    | ${2}
    ${'v0.1.2-1686130589+build1-7aebcdf'} | ${0}    | ${1}    | ${2}
  `(
    'getMajor, getMinor, getPatch for "$version"',
    ({ version, major, minor, patch }) => {
      expect(ociHelm.getMajor(version)).toBe(major);
      expect(ociHelm.getMinor(version)).toBe(minor);
      expect(ociHelm.getPatch(version)).toBe(patch);
    }
  );

  // Inspired by https://github.com/Masterminds/semver/blob/2f39fdc11c33c38e8b8b15b1f04334ba84e751f2/version_test.go#L306
  it.each`
    a                                          | b                                          | expected
    ${'1.2.3'}                                 | ${'1.2.3'}                                 | ${false}
    ${'0.1.2-1686130589_build1-7aebcdf'}       | ${'0.1.2-1686130589+build1-7aebcdf'}       | ${false}
    ${'0.1.2-1686130000_7aebcdf'}              | ${'0.1.1-1686130637_build2'}               | ${true}
    ${'0.1.2-alpha.1686130589+build1-7aebcdf'} | ${'0.1.1-alpha.1686130637_build2-ld3fn0s'} | ${true}
    ${'1.0.0-alpha'}                           | ${'0.1.1-1686130637+build2-ld3fn0s'}       | ${true}
    ${'0.1.1-1686130589_build1-7aebcdf'}       | ${'0.1.1-1686130637_main'}                 | ${false}
    ${'0.1.1-1686130589+build1-7aebcdf'}       | ${'0.1.1-1686130637_build2-ld3fn0s'}       | ${false}
    ${'7.43.0-SNAPSHOT.FOO'}                   | ${'7.43.0-SNAPSHOT.103'}                   | ${true}
    ${'0.1.1-1686130637_alpha-ld3fn0s'}        | ${'0.1.1-1686130589'}                      | ${true}
    ${'0.1.1-1686130637_build'}                | ${'0.1.1-1686130589+build1-7aebcdf'}       | ${true}
    ${'v0.2'}                                  | ${'v0.1.1-1686130589_build1-7aebcdf'}      | ${true}
  `('isGreaterThan($a, $b) === $expected', ({ a, b, expected }) => {
    expect(ociHelm.isGreaterThan(a, b)).toBe(expected);
  });

  it.each`
    version                              | range       | expected
    ${'1.2.3'}                           | ${'2.0'}    | ${true}
    ${'18.04'}                           | ${'18.1'}   | ${false}
    ${'10.1'}                            | ${'10.0.4'} | ${false}
    ${'3'}                               | ${'4.0'}    | ${true}
    ${'1.2'}                             | ${'1.3.4'}  | ${true}
    ${'3.01.2-1686130589_7aebcdf'}       | ${'3.2.0'}  | ${true}
    ${'3.1.2-1686130589+build1-7aebcdf'} | ${'3.0.0'}  | ${true}
  `(
    'isLessThanRange($version, $range) === $expected',
    ({ version, range, expected }) => {
      expect(ociHelm.isLessThanRange?.(version, range)).toBe(expected);
    }
  );

  it.each`
    a                          | b                             | expected
    ${'1.2.3'}                 | ${'1.2.3'}                    | ${true}
    ${'18.04'}                 | ${'18.4'}                     | ${true}
    ${'0.1.1-1686130637_main'} | ${'0.1.1-1686130637+7aebcdf'} | ${true}
    ${'10.0'}                  | ${'10.0.4'}                   | ${false}
    ${'3'}                     | ${'4.0'}                      | ${false}
    ${'1.2'}                   | ${'1.2.3'}                    | ${false}
  `('equals($a, $b) === $expected', ({ a, b, expected }) => {
    expect(ociHelm.equals(a, b)).toBe(expected);
  });

  // for range '*-0' see https://github.com/Masterminds/semver#checking-version-constraints
  it.each`
    versions                                                                               | range             | maxSatisfying                 | minSatisfying
    ${['2.2.2', '2.3.3', '2.3.4', '2.4.5', '2.5.1', '3.0.0']}                              | ${'*'}            | ${'3.0.0'}                    | ${'2.2.2'}
    ${['2.2.2', '2.3.3', '2.3.4', '2.4.5', '2.5.1', '3.0.0']}                              | ${'2'}            | ${'2.5.1'}                    | ${'2.2.2'}
    ${['2.2.2', '2.3.3', '2.3.4', '2.4.5', '2.5.1', '3.0.0']}                              | ${'2.*'}          | ${'2.5.1'}                    | ${'2.2.2'}
    ${['2.2.2', '2.3.3', '2.3.4', '2.4.5', '2.5.1', '3.0.0']}                              | ${'2.3'}          | ${'2.3.4'}                    | ${'2.3.3'}
    ${['2.2.2', '2.3.3', '2.3.4', '2.4.5', '2.5.1', '3.0.0']}                              | ${'>=2.3.*'}      | ${'2.3.4'}                    | ${'2.3.3'}
    ${['1.0.0', '1.3.4', '1.3.5-beta', '1.3.5-alpha', '2.5.1', '3.0.0']}                   | ${'~1.3.5-alpha'} | ${'1.3.5-beta'}               | ${'1.3.5-beta'}
    ${['0.0.1', '0.1.1-1686130589+7aebcdf', '0.4.1', '1.0.0-1686130637+ld3fn0s', '2.0.0']} | ${'*-0'}          | ${'1.0.0-1686130637+ld3fn0s'} | ${'0.1.1-1686130589+7aebcdf'}
  `(
    'Satisfying versions ("$versions","$range") === $maxSatisfying',
    ({ versions, range, expectedMaxSatisfying, expectedMinSatisfying }) => {
      const maxSatisfying = ociHelm.getSatisfyingVersion(versions, range);
      const minSatisfying = ociHelm.minSatisfyingVersion(versions, range);
      expect(maxSatisfying).toBe(expectedMaxSatisfying);
      expect(minSatisfying).toBe(expectedMinSatisfying);
    }
  );

  it.each`
    a                         | b                         | sortResult
    ${'1.1.1'}                | ${'1.2.3'}                | ${-1}
    ${'1.2.3'}                | ${'1.3.4'}                | ${-1}
    ${'2.0.1'}                | ${'1.2.3'}                | ${1}
    ${'1.2.3'}                | ${'0.9.5'}                | ${1}
    ${'1.2.3'}                | ${'1.2.3'}                | ${0}
    ${'4.2'}                  | ${'4.2-beta'}             | ${1}
    ${'4.2-alpha'}            | ${'4.2'}                  | ${-1}
    ${'4.2+foo'}              | ${'4.2+baz'}              | ${0}
    ${'1.2.3-alpha.1+build1'} | ${'1.2.3-alpha.1_build1'} | ${0}
    ${'1.2.3-alpha.1_build1'} | ${'1.2.3-alpha.2+build1'} | ${-1}
  `('sortVersions("$a", "$b") === $sortResult', ({ a, b, sortResult }) => {
    expect(ociHelm.sortVersions(a, b)).toEqual(sortResult);
  });

  it.each`
    currentValue              | rangeStrategy | currentVersion            | newVersion                 | expected
    ${null}                   | ${null}       | ${null}                   | ${'1.2.3'}                 | ${'1.2.3'}
    ${'1.2.3-alpha.1+build1'} | ${'*'}        | ${'1.2.3-alpha.1_build1'} | ${'1.2.4-alpha.3_build42'} | ${'1.2.4-alpha.3+build42'}
  `(
    'getNewValue($currentValue, $rangeStrategy, $currentVersion, $newVersion, $expected) === $expected',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      const res = ociHelm.getNewValue({
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
      });
      expect(res).toBe(expected);
    }
  );

  it.each`
    value                                | expected
    ${'3.7.0'}                           | ${'3.7.0'}
    ${'3.7-alpine'}                      | ${'3.7-alpine'}
    ${'3.8.0-alpine'}                    | ${'3.8.0-alpine'}
    ${'3.8.2'}                           | ${'3.8.2'}
    ${'0.1.1-1686130589_build1-7aebcdf'} | ${'0.1.1-1686130589+build1-7aebcdf'}
    ${'0.1.1-1686130589+main'}           | ${'0.1.1-1686130589+main'}
    ${undefined}                         | ${undefined}
  `('valueToVersion("$value") === $expected', ({ value, expected }) => {
    const res = ociHelm.valueToVersion?.(value);
    expect(res).toBe(expected);
  });

  // TODO add tests for isCompatible?
});
