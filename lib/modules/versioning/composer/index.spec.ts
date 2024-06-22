import { api as semver } from '.';

describe('modules/versioning/composer/index', () => {
  it.each`
    version    | expected
    ${'1.2.0'} | ${1}
    ${''}      | ${null}
  `('getMajor("$version") === $expected', ({ version, expected }) => {
    expect(semver.getMajor(version)).toBe(expected);
  });

  it.each`
    version    | expected
    ${'1.2.0'} | ${2}
    ${''}      | ${null}
  `('getMinor("$version") === $expected', ({ version, expected }) => {
    expect(semver.getMinor(version)).toBe(expected);
  });

  it.each`
    version    | expected
    ${'1.2.0'} | ${0}
    ${''}      | ${null}
  `('getPatch("$version") === $expected', ({ version, expected }) => {
    expect(semver.getPatch(version)).toBe(expected);
  });

  it.each`
    a               | b                  | expected
    ${'1.2.0'}      | ${'v1.2'}          | ${true}
    ${'v1.0.0'}     | ${'1'}             | ${true}
    ${'1.0@alpha3'} | ${'1.0.0-alpha.3'} | ${true}
    ${'1.0@beta'}   | ${'1.0.0-beta'}    | ${true}
    ${'1.0@rc2'}    | ${'1.0.0-rc.2'}    | ${true}
    ${'1.0.0'}      | ${'1.0.0-p1'}      | ${false}
  `('equals("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(semver.equals(a, b)).toBe(expected);
  });

  it.each`
    a             | b             | expected
    ${'1.2.0'}    | ${'v1.2'}     | ${false}
    ${'v1.0.1'}   | ${'1'}        | ${true}
    ${'1'}        | ${'1.1'}      | ${false}
    ${'1.0.0'}    | ${'1.0.0-p1'} | ${false}
    ${'1.0.0-p1'} | ${'1.0.0'}    | ${true}
    ${'1.0.0-p1'} | ${'1.0.0-p2'} | ${false}
    ${'1.0.0-p2'} | ${'1.0.0-p1'} | ${true}
    ${'1'}        | ${'1.0-p1'}   | ${false}
    ${'1.0-p1'}   | ${'1'}        | ${true}
  `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(semver.isGreaterThan(a, b)).toBe(expected);
  });

  it.each`
    version   | expected
    ${'v1.2'} | ${true}
  `('isSingleVersion("$version") === $expected', ({ version, expected }) => {
    const res = !!semver.isSingleVersion(version);
    expect(res).toBe(expected);
  });

  it.each`
    version           | expected
    ${'v1.2'}         | ${true}
    ${'v1.2.4-p2'}    | ${true}
    ${'v1.2.4-p12'}   | ${true}
    ${'v1.2.4-beta5'} | ${false}
    ${null}           | ${false}
  `('isStable("$version") === $expected', ({ version, expected }) => {
    const res = !!semver.isStable(version);
    expect(res).toBe(expected);
  });

  it.each`
    version           | expected
    ${'1.2.3'}        | ${true}
    ${'1.2.3-foo'}    | ${true}
    ${'1.2.3foo'}     | ${false}
    ${'~1.2.3'}       | ${true}
    ${'^1.2.3'}       | ${true}
    ${'>1.2.3'}       | ${true}
    ${'~1.2.3-beta1'} | ${true}
    ${'^1.2.3-alpha'} | ${true}
    ${'>1.2.3-rc2'}   | ${true}
    ${'~1.2.3@beta'}  | ${true}
    ${'^1.2.3@alpha'} | ${true}
    ${'>1.2.3@rc'}    | ${true}
    ${'1.2.3'}        | ${true}
    ${'2.5'}          | ${true}
    ${'v2.5'}         | ${true}
    ${'^1.0|^2.0'}    | ${true}
    ${'^1.0 | ^2.0'}  | ${true}
    ${'^1.0||^2.0'}   | ${true}
    ${'^1.0 || ^2.0'} | ${true}
    ${'~1.0|~2.0'}    | ${true}
    ${'~1.0 | ~2.0'}  | ${true}
    ${'~1.0||~2.0'}   | ${true}
    ${'~1.0 || ~2.0'} | ${true}
    ${'<8.0-DEV'}     | ${true}
    ${'<8-DEV'}       | ${true}
    ${'1.2.3-p1'}     | ${true}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    const res = !!semver.isValid(version);
    expect(res).toBe(expected);
  });

  it.each`
    a          | b         | expected
    ${'0.3.1'} | ${'~0.4'} | ${true}
    ${'0.5.1'} | ${'~0.4'} | ${false}
  `('isLessThanRange("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(semver.isLessThanRange?.(a, b)).toBe(expected);
  });

  it.each`
    versions                                                                                   | range        | expected
    ${['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0']}                                           | ${'~6'}      | ${null}
    ${['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0']}                                           | ${'~4'}      | ${'4.2.0'}
    ${['v0.4.0', 'v0.5.0', 'v4.0.0', 'v4.2.0', 'v5.0.0']}                                      | ${'~4'}      | ${'v4.2.0'}
    ${['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0']}                                           | ${'~0.4'}    | ${'0.5.0'}
    ${['0.4.0', '0.5.0', '4.0.0-beta1', '4.0.0-beta2', '4.2.0-beta1', '4.2.0-beta2', '5.0.0']} | ${'~4@beta'} | ${'4.0.0-beta2'}
    ${['4.0.0', '4.2.0', '5.0.0', '4.2.0-p2', '4.2.0-p12']}                                    | ${'~4'}      | ${'4.2.0-p12'}
  `(
    'getSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(semver.getSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    versions                                                                             | range        | expected
    ${['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0']}                                     | ${'~6'}      | ${null}
    ${['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0']}                                     | ${'~4'}      | ${'4.0.0'}
    ${['v0.4.0', 'v0.5.0', 'v4.0.0', 'v4.2.0', 'v5.0.0']}                                | ${'~4'}      | ${'v4.0.0'}
    ${['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0']}                                     | ${'~0.4'}    | ${'0.4.0'}
    ${['0.4.0', '0.5.0', '4.0.0-beta1', '4.0.0', '4.2.0-beta1', '4.2.0-beta2', '5.0.0']} | ${'~4@beta'} | ${'4.0.0-beta1'}
    ${['0.4.0', '0.5.0', '4.0.0-p1', '4.0.0', '4.2.0-p1', '4.2.0-p2', '5.0.0']}          | ${'~4'}      | ${'4.0.0'}
    ${['0.4.0', '0.5.0', '4.0.0-p1', '4.2.0-p1', '4.2.0-p2', '5.0.0']}                   | ${'~4'}      | ${'4.0.0-p1'}
  `(
    'minSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(semver.minSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    a          | b         | expected
    ${'0.3.1'} | ${'~0.4'} | ${false}
    ${'0.5.1'} | ${'~0.4'} | ${true}
  `('matches("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(semver.matches(a, b)).toBe(expected);
  });

  it.each`
    a                     | b                     | expected
    ${'1.0.0'}            | ${'1.0.0'}            | ${true}
    ${'1.0.0'}            | ${'>=1.0.0'}          | ${true}
    ${'1.1.0'}            | ${'^1.0.0'}           | ${true}
    ${'>=1.0.0'}          | ${'>=1.0.0'}          | ${true}
    ${'~1.0.0'}           | ${'~1.0.0'}           | ${true}
    ${'^1.0.0'}           | ${'^1.0.0'}           | ${true}
    ${'>=1.0.0'}          | ${'>=1.1.0'}          | ${false}
    ${'~1.0.0'}           | ${'~1.1.0'}           | ${false}
    ${'^1.0.0'}           | ${'^1.1.0'}           | ${false}
    ${'>=1.0.0'}          | ${'<1.0.0'}           | ${false}
    ${'~1.0.0'}           | ${'~0.9.0'}           | ${false}
    ${'^1.0.0'}           | ${'^0.9.0'}           | ${false}
    ${'^1.1.0 || ^2.0.0'} | ${'^1.0.0 || ^2.0.0'} | ${true}
    ${'^1.0.0 || ^2.0.0'} | ${'^1.1.0 || ^2.0.0'} | ${false}
    ${'^7.0.0'}           | ${'<8.0-DEV'}         | ${true}
    ${'^7.0.0'}           | ${'less than 8'}      | ${false}
  `('subset("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(semver.subset!(a, b)).toBe(expected);
  });

  it.each`
    currentValue              | rangeStrategy        | currentVersion    | newVersion       | expected
    ${'~1.0'}                 | ${'pin'}             | ${'1.0'}          | ${'V1.1'}        | ${'V1.1'}
    ${'^1.0'}                 | ${'pin'}             | ${'1.0'}          | ${'V1.1'}        | ${'V1.1'}
    ${'v1.0'}                 | ${'replace'}         | ${'1.0'}          | ${'1.1'}         | ${'v1.1'}
    ${'^1.0'}                 | ${'bump'}            | ${'1.0.0'}        | ${'1.0.7'}       | ${'^1.0.7'}
    ${'^9.4'}                 | ${'bump'}            | ${'9.4.3'}        | ${'9.4.8'}       | ${'^9.4.8'}
    ${'<2.7.14'}              | ${'bump'}            | ${'2.0.3'}        | ${'2.0.4'}       | ${'<2.7.14'}
    ${'^1.0.0'}               | ${'bump'}            | ${'1.0.0'}        | ${'1.3.5'}       | ${'^1.3.5'}
    ${'^1'}                   | ${'replace'}         | ${'1.0.0'}        | ${'1.3.5'}       | ${'^1'}
    ${'^1.0'}                 | ${'replace'}         | ${'1.0.0'}        | ${'2.3.5'}       | ${'^2.0'}
    ${'~0.2'}                 | ${'replace'}         | ${'0.2.0'}        | ${'0.3.0'}       | ${'~0.3'}
    ${'~0.2'}                 | ${'replace'}         | ${'0.2.0'}        | ${'1.1.0'}       | ${'~1.0'}
    ${'~4'}                   | ${'replace'}         | ${'4.0.0'}        | ${'4.2.0'}       | ${'~4'}
    ${'~4'}                   | ${'replace'}         | ${'4.0.0'}        | ${'5.1.0'}       | ${'~5'}
    ${'~4.0'}                 | ${'replace'}         | ${'4.0.0'}        | ${'5.1.0'}       | ${'~5.0'}
    ${'~4.0'}                 | ${'replace'}         | ${'4.0.0'}        | ${'4.1.0'}       | ${'~4.1'}
    ${'~1.2 || ~2.0'}         | ${'replace'}         | ${'2.0.0'}        | ${'3.1.0'}       | ${'~3.0'}
    ${'~1.2 || ~2.0 || ~3.0'} | ${'widen'}           | ${'2.0.0'}        | ${'5.1.0'}       | ${'~1.2 || ~2.0 || ~3.0 || ~5.0'}
    ${'^1.2'}                 | ${'widen'}           | ${'1.2.0'}        | ${'2.0.0'}       | ${'^1.2 || ^2.0'}
    ${'~1.2'}                 | ${'widen'}           | ${'1.2.0'}        | ${'2.4.0'}       | ${'~1.2 || ~2.0'}
    ${'~1.2'}                 | ${'widen'}           | ${'1.2.0'}        | ${'1.9.0'}       | ${'~1.2'}
    ${'^1.2'}                 | ${'widen'}           | ${'1.2.0'}        | ${'1.9.0'}       | ${'^1.2'}
    ${'^1.0 || ^2.0'}         | ${'widen'}           | ${'2.0.0'}        | ${'2.1.0'}       | ${'^1.0 || ^2.0'}
    ${'>=1.0 <3.0'}           | ${'widen'}           | ${'2.9.0'}        | ${'4.1.0'}       | ${'>=1.0 <4.2'}
    ${'>=1.0 <3.0'}           | ${'widen'}           | ${'2.9.0'}        | ${'2.9.5'}       | ${'>=1.0 <3.0'}
    ${'>=1.0 <3.0'}           | ${'widen'}           | ${'2.9.0'}        | ${'3.0'}         | ${'>=1.0 <3.1'}
    ${'>=1.0.0 <=3.0.4'}      | ${'widen'}           | ${'2.9.0'}        | ${'3.0.5'}       | ${'>=1.0.0 <=3.0.5'}
    ${'~1.0 || >=3.0 <=4.0'}  | ${'widen'}           | ${'2.9.0'}        | ${'5.0.0'}       | ${'~1.0 || >=3.0 <=5.0'}
    ${'+4.0.0'}               | ${'replace'}         | ${'4.0.0'}        | ${'4.2.0'}       | ${'4.2.0'}
    ${'v4.0.0'}               | ${'replace'}         | ${'4.0.0'}        | ${'4.2.0'}       | ${'v4.2.0'}
    ${'^v1.0'}                | ${'bump'}            | ${'1.0.0'}        | ${'1.1.7'}       | ${'^v1.1.7'}
    ${'^v1.0@beta'}           | ${'bump'}            | ${'1.0.0-beta3'}  | ${'1.0.0-beta5'} | ${'^v1.0.0-beta5@beta'}
    ${'^v1.0@beta'}           | ${'replace'}         | ${'1.0.0-beta3'}  | ${'2.0.0-beta5'} | ${'^v2.0.0-beta5@beta'}
    ${'^4.0@alpha'}           | ${'replace'}         | ${'4.0.0-alpha1'} | ${'4.0.0-beta5'} | ${'^4.0.0-beta5@alpha'}
    ${'3.6.*'}                | ${'replace'}         | ${'3.6.0'}        | ${'3.7'}         | ${'3.7.*'}
    ${'v3.1.*'}               | ${'replace'}         | ${'3.1.10'}       | ${'3.2.0'}       | ${'v3.2.*'}
    ${'^0.1'}                 | ${'update-lockfile'} | ${'0.1.0'}        | ${'0.1.1'}       | ${'^0.1'}
    ${'^0.1'}                 | ${'update-lockfile'} | ${'0.1.0'}        | ${'0.2.0'}       | ${'^0.2'}
    ${'^5.1'}                 | ${'update-lockfile'} | ${'5.1.0'}        | ${'5.2.0'}       | ${'^5.1'}
    ${'^5.1'}                 | ${'update-lockfile'} | ${'5.1.0'}        | ${'6.0.0'}       | ${'^6.0'}
    ${'^5'}                   | ${'update-lockfile'} | ${'5.1.0'}        | ${'5.2.0'}       | ${'^5'}
    ${'^5'}                   | ${'update-lockfile'} | ${'5.1.0'}        | ${'6.0.0'}       | ${'^6'}
    ${'^0.4.0'}               | ${'replace'}         | ${'0.4'}          | ${'0.5'}         | ${'^0.5.0'}
    ${'^0.4.0'}               | ${'replace'}         | ${'0.4'}          | ${'1.0'}         | ${'^1.0.0'}
    ${'^0.4.0'}               | ${'replace'}         | ${null}           | ${'1.0'}         | ${'1.0'}
  `(
    'getNewValue("$currentValue", "$rangeStrategy", "$currentVersion", "$newVersion") === "$expected"',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      const res = semver.getNewValue({
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
      });
      expect(res).toEqual(expected);
    },
  );

  it.each`
    versions                                                                      | expected
    ${['1.2.3-beta', '1.0.0-alpha24', '2.0.1', '1.3.4', '1.0.0-alpha9', '1.2.3']} | ${['1.0.0-alpha9', '1.0.0-alpha24', '1.2.3-beta', '1.2.3', '1.3.4', '2.0.1']}
    ${['1.2.3-p1', '1.2.3-p2', '1.2.3']}                                          | ${['1.2.3', '1.2.3-p1', '1.2.3-p2']}
    ${['1.2.3-p1', '1.2.2']}                                                      | ${['1.2.2', '1.2.3-p1']}
    ${['1.0-p1', '1']}                                                            | ${['1', '1.0-p1']}
  `('$versions -> sortVersions -> $expected ', ({ versions, expected }) => {
    expect(versions.sort(semver.sortVersions)).toEqual(expected);
  });

  it.each`
    version       | expected
    ${'1.2.0'}    | ${true}
    ${'1.2.0-p1'} | ${true}
  `('isCompatible("$version") === $expected', ({ version, expected }) => {
    expect(semver.isCompatible(version)).toBe(expected);
  });
});
