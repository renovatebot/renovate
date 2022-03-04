import { api as ubuntu } from '.';

describe('modules/versioning/ubuntu/index', () => {
  test.each`
    version      | expected
    ${undefined} | ${false}
    ${null}      | ${false}
    ${''}        | ${false}
    ${'xenial'}  | ${false}
    ${'04.10'}   | ${true}
    ${'05.04'}   | ${true}
    ${'05.10'}   | ${true}
    ${'6.06'}    | ${true}
    ${'6.10'}    | ${true}
    ${'7.04'}    | ${true}
    ${'7.10'}    | ${true}
    ${'8.04'}    | ${true}
    ${'8.10'}    | ${true}
    ${'9.04'}    | ${true}
    ${'9.10'}    | ${true}
    ${'10.04.4'} | ${true}
    ${'10.10'}   | ${true}
    ${'11.04'}   | ${true}
    ${'11.10'}   | ${true}
    ${'12.04.5'} | ${true}
    ${'12.10'}   | ${true}
    ${'13.04'}   | ${true}
    ${'13.10'}   | ${true}
    ${'14.04.6'} | ${true}
    ${'14.10'}   | ${true}
    ${'15.04'}   | ${true}
    ${'15.10'}   | ${true}
    ${'16.04.7'} | ${true}
    ${'16.10'}   | ${true}
    ${'17.04'}   | ${true}
    ${'17.10'}   | ${true}
    ${'18.04.5'} | ${true}
    ${'18.10'}   | ${true}
    ${'19.04'}   | ${true}
    ${'19.10'}   | ${true}
    ${'20.04'}   | ${true}
    ${'20.10'}   | ${true}
    ${'2020.04'} | ${false}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(!!ubuntu.isValid(version)).toBe(expected);
  });

  test.each`
    version      | range        | expected
    ${undefined} | ${undefined} | ${false}
    ${null}      | ${undefined} | ${false}
    ${''}        | ${undefined} | ${false}
    ${'04.10'}   | ${undefined} | ${true}
    ${'20.10'}   | ${undefined} | ${true}
  `(
    'isCompatible("$version") === $expected',
    ({ version, range, expected }) => {
      const res = ubuntu.isCompatible(version, range);
      expect(!!res).toBe(expected);
    }
  );

  test.each`
    version      | expected
    ${undefined} | ${false}
    ${null}      | ${false}
    ${''}        | ${false}
    ${'20.04'}   | ${true}
    ${'>=20.04'} | ${false}
  `('isSingleVersion("$version") === $expected', ({ version, expected }) => {
    expect(!!ubuntu.isSingleVersion(version)).toBe(expected);
  });

  test.each`
    version      | expected
    ${undefined} | ${false}
    ${null}      | ${false}
    ${''}        | ${false}
    ${'04.10'}   | ${false}
    ${'05.04'}   | ${false}
    ${'05.10'}   | ${false}
    ${'6.06'}    | ${false}
    ${'6.10'}    | ${false}
    ${'7.04'}    | ${false}
    ${'7.10'}    | ${false}
    ${'8.04'}    | ${true}
    ${'8.10'}    | ${false}
    ${'9.04'}    | ${false}
    ${'9.10'}    | ${false}
    ${'10.04.4'} | ${true}
    ${'10.10'}   | ${false}
    ${'11.04'}   | ${false}
    ${'11.10'}   | ${false}
    ${'12.04.5'} | ${true}
    ${'12.10'}   | ${false}
    ${'13.04'}   | ${false}
    ${'13.10'}   | ${false}
    ${'14.04.6'} | ${true}
    ${'14.10'}   | ${false}
    ${'15.04'}   | ${false}
    ${'15.10'}   | ${false}
    ${'16.04.7'} | ${true}
    ${'16.10'}   | ${false}
    ${'17.04'}   | ${false}
    ${'17.10'}   | ${false}
    ${'18.04.5'} | ${true}
    ${'18.10'}   | ${false}
    ${'19.04'}   | ${false}
    ${'19.10'}   | ${false}
    ${'20.04'}   | ${true}
    ${'20.10'}   | ${false}
    ${'42.01'}   | ${false}
    ${'42.02'}   | ${false}
    ${'42.03'}   | ${false}
    ${'42.04'}   | ${true}
    ${'42.05'}   | ${false}
    ${'42.06'}   | ${false}
    ${'42.07'}   | ${false}
    ${'42.08'}   | ${false}
    ${'42.09'}   | ${false}
    ${'42.10'}   | ${false}
    ${'42.11'}   | ${false}
    ${'2020.04'} | ${false}
    ${'22.04'}   | ${false}
  `('isStable("$version") === $expected', ({ version, expected }) => {
    const res = !!ubuntu.isStable(version);
    expect(res).toBe(expected);
  });

  test.each`
    version      | expected
    ${undefined} | ${false}
    ${null}      | ${false}
    ${''}        | ${false}
    ${'02.10'}   | ${false}
    ${'04.10'}   | ${true}
    ${'05.04'}   | ${true}
    ${'6.06'}    | ${true}
    ${'8.04'}    | ${true}
    ${'9.04'}    | ${true}
    ${'10.04.4'} | ${true}
    ${'12.04.5'} | ${true}
    ${'13.04'}   | ${true}
    ${'14.04.6'} | ${true}
    ${'15.04'}   | ${true}
    ${'16.04.7'} | ${true}
    ${'16.10'}   | ${true}
    ${'17.04'}   | ${true}
    ${'18.04.5'} | ${true}
    ${'18.10'}   | ${true}
    ${'20.04'}   | ${true}
    ${'20.10'}   | ${true}
    ${'30.11'}   | ${true}
    ${'2020.04'} | ${false}
  `('isVersion("$version") === $expected', ({ version, expected }) => {
    expect(!!ubuntu.isVersion(version)).toBe(expected);
  });

  test.each`
    version      | major   | minor   | patch
    ${undefined} | ${null} | ${null} | ${null}
    ${null}      | ${null} | ${null} | ${null}
    ${''}        | ${null} | ${null} | ${null}
    ${'42'}      | ${null} | ${null} | ${null}
    ${'2020.04'} | ${null} | ${null} | ${null}
    ${'04.10'}   | ${4}    | ${10}   | ${null}
    ${'18.04.5'} | ${18}   | ${4}    | ${5}
    ${'20.04'}   | ${20}   | ${4}    | ${null}
  `(
    'getMajor, getMinor, getPatch for "$version"',
    ({ version, major, minor, patch }) => {
      expect(ubuntu.getMajor(version)).toBe(major);
      expect(ubuntu.getMinor(version)).toBe(minor);
      expect(ubuntu.getPatch(version)).toBe(patch);
    }
  );

  test.each`
    a          | b            | expected
    ${'20.04'} | ${'2020.04'} | ${false}
    ${'focal'} | ${'20.04'}   | ${false}
    ${'20.04'} | ${'focal'}   | ${false}
    ${'19.10'} | ${'19.10'}   | ${true}
  `('equals($a, $b) === $expected', ({ a, b, expected }) => {
    expect(ubuntu.equals(a, b)).toBe(expected);
  });

  test.each`
    a            | b            | expected
    ${'20.04'}   | ${'20.10'}   | ${false}
    ${'20.10'}   | ${'20.04'}   | ${true}
    ${'19.10'}   | ${'20.04'}   | ${false}
    ${'20.04'}   | ${'19.10'}   | ${true}
    ${'16.04'}   | ${'16.04.7'} | ${false}
    ${'16.04.7'} | ${'16.04'}   | ${true}
    ${'16.04.1'} | ${'16.04.7'} | ${false}
    ${'16.04.7'} | ${'16.04.1'} | ${true}
    ${'19.10.1'} | ${'20.04.1'} | ${false}
    ${'20.04.1'} | ${'19.10.1'} | ${true}
    ${'xxx'}     | ${'yyy'}     | ${false}
  `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(ubuntu.isGreaterThan(a, b)).toBe(expected);
  });

  test.each`
    versions                                | range        | expected
    ${['18.10', '19.04', '19.10', '20.04']} | ${'2020.04'} | ${null}
    ${['18.10', '19.04', '19.10', '20.04']} | ${'foobar'}  | ${null}
    ${['18.10', '19.04', '19.10', '20.04']} | ${'20.04'}   | ${'20.04'}
    ${['18.10', '19.04', '19.10', '20.04']} | ${'19.10'}   | ${'19.10'}
    ${['18.10', '19.04', '19.10', '20.04']} | ${'04.10'}   | ${null}
  `(
    'getSatisfyingVersion($versions, "$range") === "$expected"',
    ({ versions, range, expected }) => {
      expect(ubuntu.getSatisfyingVersion(versions, range)).toBe(expected);
    }
  );

  test.each`
    versions                                | range        | expected
    ${['18.10', '19.04', '19.10', '20.04']} | ${'2020.04'} | ${null}
    ${['18.10', '19.04', '19.10', '20.04']} | ${'foobar'}  | ${null}
    ${['18.10', '19.04', '19.10', '20.04']} | ${'20.04'}   | ${'20.04'}
    ${['18.10', '19.04', '19.10', '20.04']} | ${'19.10'}   | ${'19.10'}
    ${['18.10', '19.04', '19.10', '20.04']} | ${'04.10'}   | ${null}
  `(
    'minSatisfyingVersion($versions, "$range") === "$expected"',
    ({ versions, range, expected }) => {
      expect(ubuntu.minSatisfyingVersion(versions, range)).toBe(expected);
    }
  );

  test.each`
    currentValue | rangeStrategy | currentVersion | newVersion  | expected
    ${undefined} | ${undefined}  | ${undefined}   | ${'foobar'} | ${'foobar'}
  `(
    'getNewValue("$currentValue", "$rangeStrategy", "$currentVersion", "$newVersion") === "$expected"',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      expect(
        ubuntu.getNewValue({
          currentValue,
          rangeStrategy,
          currentVersion,
          newVersion,
        })
      ).toBe(expected);
    }
  );

  test.each`
    versions                                        | expected
    ${['17.03', '18.04', '18.04', '6.10', '19.10']} | ${['6.10', '17.03', '18.04', '18.04', '19.10']}
  `('$versions -> sortVersions -> $expected ', ({ versions, expected }) => {
    expect(versions.sort(ubuntu.sortVersions)).toEqual(expected);
  });

  test.each`
    version    | range        | expected
    ${'20.04'} | ${'2020.04'} | ${false}
    ${'20.04'} | ${'20.04'}   | ${true}
    ${'20.04'} | ${'20.04.0'} | ${false}
  `(
    'matches("$version", "$range") === "$expected"',
    ({ version, range, expected }) => {
      expect(ubuntu.matches(version, range)).toBe(expected);
    }
  );
});
