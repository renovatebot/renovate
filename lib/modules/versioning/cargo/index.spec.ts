import { api as semver } from '.';

describe('modules/versioning/cargo/index', () => {
  test.each`
    version    | range                     | expected
    ${'4.2.0'} | ${'4.2, >= 3.0, < 5.0.0'} | ${true}
    ${'4.2.0'} | ${'2.0, >= 3.0, < 5.0.0'} | ${false}
    ${'4.2.0'} | ${'4.2.0, < 4.2.4'}       | ${true}
    ${'4.2.0'} | ${'4.3.0, 3.0.0'}         | ${false}
    ${'4.2.0'} | ${'> 5.0.0, <= 6.0.0'}    | ${false}
  `(
    'matches("$version", "$range") === "$expected"',
    ({ version, range, expected }) => {
      expect(semver.matches(version, range)).toBe(expected);
    }
  );

  test.each`
    versions                                                  | range               | expected
    ${['4.2.1', '0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0']} | ${'4.*.0, < 4.2.5'} | ${'4.2.1'}
    ${['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0', '5.0.3']} | ${'5.0, > 5.0.0'}   | ${'5.0.3'}
  `(
    'getSatisfyingVersion($versions, "$range") === "$expected"',
    ({ versions, range, expected }) => {
      expect(semver.getSatisfyingVersion(versions, range)).toBe(expected);
    }
  );

  test.each`
    version                                | expected
    ${'1'}                                 | ${true}
    ${'1.2'}                               | ${true}
    ${'1.2.3'}                             | ${true}
    ${'^1.2.3'}                            | ${true}
    ${'~1.2.3'}                            | ${true}
    ${'1.2.*'}                             | ${true}
    ${'< 3.0, >= 1.0.0 <= 2.0.0'}          | ${true}
    ${'< 3.0, >= 1.0.0 <= 2.0.0, = 5.1.2'} | ${true}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(!!semver.isValid(version)).toBe(expected);
  });

  test.each`
    version    | expected
    ${'1'}     | ${false}
    ${'1.2'}   | ${false}
    ${'1.2.3'} | ${true}
  `('isVersion("$version") === $expected', ({ version, expected }) => {
    expect(!!semver.isVersion(version)).toBe(expected);
  });

  test.each`
    version    | range                  | expected
    ${'0.9.0'} | ${'>= 1.0.0 <= 2.0.0'} | ${true}
    ${'1.9.0'} | ${'>= 1.0.0 <= 2.0.0'} | ${false}
  `(
    'isLessThanRange("$version", "$range") === "$expected"',
    ({ version, range, expected }) => {
      expect(semver.isLessThanRange?.(version, range)).toBe(expected);
    }
  );

  test.each`
    versions                                         | range                         | expected
    ${['0.4.0', '0.5.0', '4.2.0', '4.3.0', '5.0.0']} | ${'4.*, > 4.2'}               | ${'4.3.0'}
    ${['0.4.0', '0.5.0', '4.2.0', '5.0.0']}          | ${'4.0.0'}                    | ${'4.2.0'}
    ${['0.4.0', '0.5.0', '4.2.0', '5.0.0']}          | ${'4.0.0, = 0.5.0'}           | ${null}
    ${['0.4.0', '0.5.0', '4.2.0', '5.0.0']}          | ${'4.0.0, > 4.1.0, <= 4.3.5'} | ${'4.2.0'}
    ${['0.4.0', '0.5.0', '4.2.0', '5.0.0']}          | ${'6.2.0, 3.*'}               | ${null}
  `(
    'minSatisfyingVersion($versions, "$range") === "$expected"',
    ({ versions, range, expected }) => {
      expect(semver.minSatisfyingVersion(versions, range)).toBe(expected);
    }
  );

  test.each`
    version            | expected
    ${'1.2.3'}         | ${false}
    ${'1.2.3-alpha.1'} | ${false}
    ${'=1.2.3'}        | ${true}
    ${'= 1.2.3'}       | ${true}
    ${'  = 1.2.3'}     | ${true}
    ${'1'}             | ${false}
    ${'1.2'}           | ${false}
    ${'*'}             | ${false}
    ${'1.*'}           | ${false}
    ${'1.2.*'}         | ${false}
  `('isSingleVersion("$version") === $expected', ({ version, expected }) => {
    expect(!!semver.isSingleVersion(version)).toBe(expected);
  });

  test.each`
    currentValue             | rangeStrategy | currentVersion | newVersion      | expected
    ${null}                  | ${'bump'}     | ${'1.0.0'}     | ${'1.1.0'}      | ${null}
    ${'*'}                   | ${'bump'}     | ${'1.0.0'}     | ${'1.1.0'}      | ${'*'}
    ${'=1.0.0'}              | ${'bump'}     | ${'1.0.0'}     | ${'1.1.0'}      | ${'=1.1.0'}
    ${'   =1.0.0'}           | ${'bump'}     | ${'1.0.0'}     | ${'1.1.0'}      | ${'=1.1.0'}
    ${'= 1.0.0'}             | ${'bump'}     | ${'1.0.0'}     | ${'1.1.0'}      | ${'= 1.1.0'}
    ${'  = 1.0.0'}           | ${'bump'}     | ${'1.0.0'}     | ${'1.1.0'}      | ${'=1.1.0'}
    ${'  =   1.0.0'}         | ${'bump'}     | ${'1.0.0'}     | ${'1.1.0'}      | ${'=1.1.0'}
    ${'=    1.0.0'}          | ${'bump'}     | ${'1.0.0'}     | ${'1.1.0'}      | ${'= 1.1.0'}
    ${'1.0.0'}               | ${'bump'}     | ${'1.0.0'}     | ${'1.1.0'}      | ${'1.1.0'}
    ${'^1.0'}                | ${'bump'}     | ${'1.0.0'}     | ${'1.0.7'}      | ${'^1.0'}
    ${'^1.0.0'}              | ${'replace'}  | ${'1.0.0'}     | ${'2.0.7'}      | ${'^2.0.0'}
    ${'1.0.0'}               | ${'replace'}  | ${'1.0.0'}     | ${'2.0.7'}      | ${'2.0.0'}
    ${'^1'}                  | ${'bump'}     | ${'1.0.0'}     | ${'2.1.7'}      | ${'^2'}
    ${'~1'}                  | ${'bump'}     | ${'1.0.0'}     | ${'1.1.7'}      | ${'~1'}
    ${'5'}                   | ${'bump'}     | ${'5.0.0'}     | ${'5.1.7'}      | ${'5'}
    ${'5'}                   | ${'bump'}     | ${'5.0.0'}     | ${'6.1.7'}      | ${'6'}
    ${'5.0'}                 | ${'bump'}     | ${'5.0.0'}     | ${'5.0.7'}      | ${'5.0'}
    ${'5.0'}                 | ${'bump'}     | ${'5.0.0'}     | ${'5.1.7'}      | ${'5.1'}
    ${'5.0'}                 | ${'bump'}     | ${'5.0.0'}     | ${'6.1.7'}      | ${'6.1'}
    ${'5.0'}                 | ${'replace'}  | ${'5.0.0'}     | ${'6.1.7'}      | ${'6.1'}
    ${'=1.0.0'}              | ${'replace'}  | ${'1.0.0'}     | ${'1.1.0'}      | ${'=1.1.0'}
    ${'1.0.*'}               | ${'replace'}  | ${'1.0.0'}     | ${'1.1.0'}      | ${'1.1.*'}
    ${'1.*'}                 | ${'replace'}  | ${'1.0.0'}     | ${'2.1.0'}      | ${'2.*'}
    ${'~0.6.1'}              | ${'replace'}  | ${'0.6.8'}     | ${'0.7.0-rc.2'} | ${'~0.7.0-rc'}
    ${'<1.3.4'}              | ${'replace'}  | ${'1.2.3'}     | ${'1.5.0'}      | ${'<1.5.1'}
    ${'< 1.3.4'}             | ${'replace'}  | ${'1.2.3'}     | ${'1.5.0'}      | ${'< 1.5.1'}
    ${'<   1.3.4'}           | ${'replace'}  | ${'1.2.3'}     | ${'1.5.0'}      | ${'< 1.5.1'}
    ${'<=1.3.4'}             | ${'replace'}  | ${'1.2.3'}     | ${'1.5.0'}      | ${'<=1.5.0'}
    ${'<= 1.3.4'}            | ${'replace'}  | ${'1.2.3'}     | ${'1.5.0'}      | ${'<= 1.5.0'}
    ${'<=   1.3.4'}          | ${'replace'}  | ${'1.2.3'}     | ${'1.5.0'}      | ${'<= 1.5.0'}
    ${'>= 0.1.21, < 0.2.0'}  | ${'bump'}     | ${'0.1.21'}    | ${'0.1.24'}     | ${'>= 0.1.24, < 0.2.0'}
    ${'>= 0.1.21, <= 0.2.0'} | ${'bump'}     | ${'0.1.21'}    | ${'0.1.24'}     | ${'>= 0.1.24, <= 0.2.0'}
    ${'>= 0.0.1, <= 0.1'}    | ${'bump'}     | ${'0.0.1'}     | ${'0.0.2'}      | ${'>= 0.0.2, <= 0.1'}
    ${'>= 1.2.3, <= 1'}      | ${'bump'}     | ${'1.2.3'}     | ${'1.2.4'}      | ${'>= 1.2.4, <= 1'}
    ${'>= 1.2.3, <= 1.0'}    | ${'bump'}     | ${'1.2.3'}     | ${'1.2.4'}      | ${'>= 1.2.4, <= 1.2'}
    ${'>= 0.0.1, < 0.1'}     | ${'bump'}     | ${'0.1.0'}     | ${'0.2.1'}      | ${'>= 0.2.1, < 0.3'}
  `(
    'getNewValue("$currentValue", "$rangeStrategy", "$currentVersion", "$newVersion") === "$expected"',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      expect(
        semver.getNewValue({
          currentValue,
          rangeStrategy,
          currentVersion,
          newVersion,
        })
      ).toBe(expected);
    }
  );
});
