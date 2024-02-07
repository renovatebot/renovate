import { api as semver } from '.';

describe('modules/versioning/go-mod-directive/index', () => {
  it.each`
    version     | range     | expected
    ${'1.16.0'} | ${'1.16'} | ${true}
    ${'1.16.1'} | ${'1.16'} | ${true}
    ${'1.15.0'} | ${'1.16'} | ${false}
    ${'1.19.1'} | ${'1.16'} | ${true}
    ${'2.0.0'}  | ${'1.16'} | ${false}
  `(
    'matches("$version", "$range") === "$expected"',
    ({ version, range, expected }) => {
      expect(semver.matches(version, range)).toBe(expected);
    },
  );

  it.each`
    versions                          | range     | expected
    ${['1.16.0', '1.16.1', '1.17.0']} | ${'1.16'} | ${'1.17.0'}
  `(
    'getSatisfyingVersion($versions, "$range") === "$expected"',
    ({ versions, range, expected }) => {
      expect(semver.getSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    version    | expected
    ${'1'}     | ${false}
    ${'1.2'}   | ${true}
    ${'1.2.3'} | ${true}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(!!semver.isValid(version)).toBe(expected);
  });

  it.each`
    version    | expected
    ${'1'}     | ${false}
    ${'1.2'}   | ${false}
    ${'1.2.3'} | ${true}
  `('isVersion("$version") === $expected', ({ version, expected }) => {
    expect(!!semver.isVersion(version)).toBe(expected);
  });

  it.each`
    version     | range     | expected
    ${'1.15.0'} | ${'1.16'} | ${true}
    ${'1.19.0'} | ${'1.16'} | ${false}
  `(
    'isLessThanRange("$version", "$range") === "$expected"',
    ({ version, range, expected }) => {
      expect(semver.isLessThanRange?.(version, range)).toBe(expected);
    },
  );

  it.each`
    versions                                | range     | expected
    ${['1.15.0', '1.16.0', '1.16.1']}       | ${'1.16'} | ${'1.16.0'}
    ${['0.4.0', '0.5.0', '4.2.0', '5.0.0']} | ${'1.16'} | ${null}
  `(
    'minSatisfyingVersion($versions, "$range") === "$expected"',
    ({ versions, range, expected }) => {
      expect(semver.minSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    currentValue | rangeStrategy | currentVersion | newVersion  | expected
    ${'1.16'}    | ${'bump'}     | ${'1.16.4'}    | ${'1.17.0'} | ${'1.17'}
    ${'1.16'}    | ${'bump'}     | ${'1.16.4'}    | ${'1.16.4'} | ${'1.16'}
    ${'1.16'}    | ${'replace'}  | ${'1.16.4'}    | ${'1.16.4'} | ${'1.16'}
    ${'1.16'}    | ${'replace'}  | ${'1.21.2'}    | ${'1.21.2'} | ${'1.21.2'}
    ${'1.16'}    | ${'widen'}    | ${'1.16.4'}    | ${'1.16.4'} | ${'1.16'}
    ${'1.16'}    | ${'bump'}     | ${'1.16.4'}    | ${'1.21.3'} | ${'1.21.3'}
    ${'1.21.2'}  | ${'bump'}     | ${'1.21.2'}    | ${'1.21.3'} | ${'1.21.3'}
  `(
    'getNewValue("$currentValue", "$rangeStrategy", "$currentVersion", "$newVersion") === "$expected"',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      expect(
        semver.getNewValue({
          currentValue,
          rangeStrategy,
          currentVersion,
          newVersion,
        }),
      ).toBe(expected);
    },
  );
});
