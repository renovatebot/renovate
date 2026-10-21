import { api as julia } from './index.ts';

describe('modules/versioning/julia/index', () => {
  it.each`
    version    | expected
    ${'1'}     | ${false}
    ${'1.2'}   | ${false}
    ${'1.2.3'} | ${true}
  `('isVersion("$version") === $expected', ({ version, expected }) => {
    expect(julia.isVersion(version)).toBe(expected);
  });

  it.each`
    version               | expected
    ${'1'}                | ${true}
    ${'1.2'}              | ${true}
    ${'1.2.3'}            | ${true}
    ${'^1.2.3'}           | ${true}
    ${'~1.2.3'}           | ${true}
    ${'= 1.2.3'}          | ${true}
    ${'>= 1.2.3'}         | ${true}
    ${'≥ 1.2.3'}          | ${true}
    ${'< 1.2.3'}          | ${true}
    ${'1.2, 2'}           | ${true}
    ${'1.2.3 - 4.5'}      | ${true}
    ${'=0.10.1, =0.10.3'} | ${true}
    ${'not a version'}    | ${false}
    ${'1.2.3beta'}        | ${false}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(julia.isValid(version)).toBe(expected);
  });

  // Caret examples from
  // https://pkgdocs.julialang.org/v1/compatibility/#Caret-specifiers
  it.each`
    version    | range       | expected
    ${'1.2.3'} | ${'^1.2.3'} | ${true}
    ${'1.0.0'} | ${'^1.2.3'} | ${false}
    ${'1.5.0'} | ${'^1.2.3'} | ${true}
    ${'2.0.0'} | ${'^1.2.3'} | ${false}
    ${'1.2.0'} | ${'^1.2'}   | ${true}
    ${'1.9.9'} | ${'^1.2'}   | ${true}
    ${'2.0.0'} | ${'^1.2'}   | ${false}
    ${'1.0.0'} | ${'^1'}     | ${true}
    ${'1.9.9'} | ${'^1'}     | ${true}
    ${'2.0.0'} | ${'^1'}     | ${false}
    ${'0.2.3'} | ${'^0.2.3'} | ${true}
    ${'0.2.9'} | ${'^0.2.3'} | ${true}
    ${'0.3.0'} | ${'^0.2.3'} | ${false}
    ${'0.0.3'} | ${'^0.0.3'} | ${true}
    ${'0.0.4'} | ${'^0.0.3'} | ${false}
    ${'0.0.0'} | ${'^0.0'}   | ${true}
    ${'0.0.9'} | ${'^0.0'}   | ${true}
    ${'0.1.0'} | ${'^0.0'}   | ${false}
    ${'0.0.0'} | ${'^0'}     | ${true}
    ${'0.9.9'} | ${'^0'}     | ${true}
    ${'1.0.0'} | ${'^0'}     | ${false}
  `(
    'matches("$version", "$range") === $expected (caret)',
    ({ version, range, expected }) => {
      expect(julia.matches(version, range)).toBe(expected);
    },
  );

  // Tilde examples from
  // https://pkgdocs.julialang.org/v1/compatibility/#Tilde-specifiers
  it.each`
    version    | range       | expected
    ${'1.2.3'} | ${'~1.2.3'} | ${true}
    ${'1.2.2'} | ${'~1.2.3'} | ${false}
    ${'1.2.9'} | ${'~1.2.3'} | ${true}
    ${'1.3.0'} | ${'~1.2.3'} | ${false}
    ${'1.2.0'} | ${'~1.2'}   | ${true}
    ${'1.2.9'} | ${'~1.2'}   | ${true}
    ${'1.3.0'} | ${'~1.2'}   | ${false}
    ${'1.0.0'} | ${'~1'}     | ${true}
    ${'1.9.9'} | ${'~1'}     | ${true}
    ${'2.0.0'} | ${'~1'}     | ${false}
    ${'0.2.3'} | ${'~0.2.3'} | ${true}
    ${'0.2.9'} | ${'~0.2.3'} | ${true}
    ${'0.3.0'} | ${'~0.2.3'} | ${false}
    ${'0.0.3'} | ${'~0.0.3'} | ${true}
    ${'0.0.9'} | ${'~0.0.3'} | ${true}
    ${'0.1.0'} | ${'~0.0.3'} | ${false}
    ${'0.0.0'} | ${'~0.0'}   | ${true}
    ${'0.0.9'} | ${'~0.0'}   | ${true}
    ${'0.1.0'} | ${'~0.0'}   | ${false}
    ${'0.0.0'} | ${'~0'}     | ${true}
    ${'0.9.9'} | ${'~0'}     | ${true}
    ${'1.0.0'} | ${'~0'}     | ${false}
  `(
    'matches("$version", "$range") === $expected (tilde)',
    ({ version, range, expected }) => {
      expect(julia.matches(version, range)).toBe(expected);
    },
  );

  // A bare version is a caret range, unlike npm where it is exact.
  // https://pkgdocs.julialang.org/v1/compatibility/#Version-specifier-format
  it.each`
    version    | range       | expected
    ${'1.2.5'} | ${'1.2.3'}  | ${true}
    ${'2.0.0'} | ${'1.2.3'}  | ${false}
    ${'1.5.0'} | ${'1.2'}    | ${true}
    ${'1.2.5'} | ${'v1.2.3'} | ${true}
  `(
    'matches("$version", "$range") === $expected (bare)',
    ({ version, range, expected }) => {
      expect(julia.matches(version, range)).toBe(expected);
    },
  );

  // A comma is a union, not an intersection as in Cargo: the `0.2, 1`
  // rows leave a gap at 0.5.0, which intersection could not produce.
  it.each`
    version    | range       | expected
    ${'2.0.0'} | ${'1.2, 2'} | ${true}
    ${'2.9.9'} | ${'1.2, 2'} | ${true}
    ${'3.0.0'} | ${'1.2, 2'} | ${false}
    ${'0.2.0'} | ${'0.2, 1'} | ${true}
    ${'0.5.0'} | ${'0.2, 1'} | ${false}
    ${'1.0.0'} | ${'0.2, 1'} | ${true}
  `(
    'matches("$version", "$range") === $expected (union)',
    ({ version, range, expected }) => {
      expect(julia.matches(version, range)).toBe(expected);
    },
  );

  // Equality pins one release; a union of pins admits only those.
  it.each`
    version     | range                 | expected
    ${'1.2.3'}  | ${'=1.2.3'}           | ${true}
    ${'1.2.4'}  | ${'=1.2.3'}           | ${false}
    ${'0.10.1'} | ${'=0.10.1, =0.10.3'} | ${true}
    ${'0.10.2'} | ${'=0.10.1, =0.10.3'} | ${false}
    ${'0.10.3'} | ${'=0.10.1, =0.10.3'} | ${true}
  `(
    'matches("$version", "$range") === $expected (equality)',
    ({ version, range, expected }) => {
      expect(julia.matches(version, range)).toBe(expected);
    },
  );

  // Inequalities, with `≥` accepted as a synonym for `>=`.
  it.each`
    version    | range         | expected
    ${'1.2.3'} | ${'>= 1.2.3'} | ${true}
    ${'9.9.9'} | ${'>= 1.2.3'} | ${true}
    ${'1.2.2'} | ${'>= 1.2.3'} | ${false}
    ${'1.2.3'} | ${'≥ 1.2.3'}  | ${true}
    ${'1.2.2'} | ${'≥ 1.2.3'}  | ${false}
    ${'1.2.2'} | ${'< 1.2.3'}  | ${true}
    ${'1.2.3'} | ${'< 1.2.3'}  | ${false}
  `(
    'matches("$version", "$range") === $expected (inequality)',
    ({ version, range, expected }) => {
      expect(julia.matches(version, range)).toBe(expected);
    },
  );

  // Hyphen ranges include both endpoints; a short upper endpoint is a
  // wildcard, so `1.2.3 - 4.5` runs to 4.6.0.
  // https://pkgdocs.julialang.org/v1/compatibility/#Hyphen-specifiers
  it.each`
    version    | range              | expected
    ${'1.2.3'} | ${'1.2.3 - 4.5.6'} | ${true}
    ${'4.5.6'} | ${'1.2.3 - 4.5.6'} | ${true}
    ${'4.5.7'} | ${'1.2.3 - 4.5.6'} | ${false}
    ${'4.5.6'} | ${'1.2.3 - 4.5'}   | ${true}
    ${'4.6.0'} | ${'1.2.3 - 4.5'}   | ${false}
  `(
    'matches("$version", "$range") === $expected (hyphen)',
    ({ version, range, expected }) => {
      expect(julia.matches(version, range)).toBe(expected);
    },
  );

  it.each`
    versions                                                  | range       | expected
    ${['0.4.0', '0.5.0', '4.0.0', '4.2.0', '4.2.1', '5.0.0']} | ${'^4.2'}   | ${'4.2.1'}
    ${['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0']}          | ${'4.2'}    | ${'4.2.0'}
    ${['1.0.0', '1.5.0', '2.0.0', '3.0.0']}                   | ${'1.2, 2'} | ${'2.0.0'}
    ${['1.0.0', '1.5.0']}                                     | ${'^9'}     | ${null}
    ${[]}                                                     | ${'^1'}     | ${null}
  `(
    'getSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(julia.getSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    versions                                | range       | expected
    ${['1.0.0', '1.5.0', '2.0.0', '3.0.0']} | ${'1.2, 2'} | ${'1.5.0'}
    ${['1.0.0', '1.5.0']}                   | ${'^9'}     | ${null}
  `(
    'minSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(julia.minSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    constraint            | expected
    ${'=1.2.3'}           | ${true}
    ${'= 1.2.3'}          | ${true}
    ${'1.2.3'}            | ${false}
    ${'^1.2.3'}           | ${false}
    ${'~1.2.3'}           | ${false}
    ${'=0.10.1, =0.10.3'} | ${false}
  `(
    'isSingleVersion("$constraint") === $expected',
    ({ constraint, expected }) => {
      expect(julia.isSingleVersion(constraint)).toBe(expected);
    },
  );

  it.each`
    version    | range       | expected
    ${'1.0.0'} | ${'^1.2.3'} | ${true}
    ${'1.2.3'} | ${'^1.2.3'} | ${false}
    ${'2.0.0'} | ${'^1.2.3'} | ${false}
    ${'0.0.2'} | ${'^0.0.3'} | ${true}
    ${'0.0.3'} | ${'^0.0.3'} | ${false}
    ${'0.1.0'} | ${'1.2, 2'} | ${true}
    ${'3.0.0'} | ${'1.2, 2'} | ${false}
  `(
    'isLessThanRange("$version", "$range") === $expected',
    ({ version, range, expected }) => {
      expect(julia.isLessThanRange!(version, range)).toBe(expected);
    },
  );

  it.each`
    current         | version          | expected
    ${'1.2.3'}      | ${'1.2.4'}       | ${false}
    ${'1.2.3'}      | ${'1.3.0'}       | ${false}
    ${'1.2.3'}      | ${'2.0.0'}       | ${true}
    ${'0.2.3'}      | ${'0.2.4'}       | ${false}
    ${'0.2.3'}      | ${'0.3.0'}       | ${true}
    ${'0.0.3'}      | ${'0.0.4'}       | ${true}
    ${'0.0.3'}      | ${'0.0.3'}       | ${false}
    ${'1.2.3-rc.1'} | ${'1.2.3'}       | ${true}
    ${'1.2.3'}      | ${'1.2.3-alpha'} | ${true}
    ${'1.2.3-rc.1'} | ${'1.2.3-rc.2'}  | ${true}
  `(
    'isBreaking("$current", "$version") === $expected',
    ({ current, version, expected }) => {
      expect(julia.isBreaking!(current, version)).toBe(expected);
    },
  );

  it('getPinnedValue formats with `=`', () => {
    expect(julia.getPinnedValue!('1.2.3')).toBe('=1.2.3');
  });

  // `currentValue` is the string in `[compat]`, `newVersion` the release being
  // proposed, and `expected` what `[compat]` should become. `currentVersion`,
  // the release currently resolved, is left out: no result depends on it.
  // `bump` raises the floor and keeps the shape.
  it.each`
    currentValue    | rangeStrategy | newVersion  | expected
    ${'1.2.3'}      | ${'bump'}     | ${'1.2.4'}  | ${'1.2.4'}
    ${'^1.2.3'}     | ${'bump'}     | ${'1.2.4'}  | ${'^1.2.4'}
    ${'0.10, 0.11'} | ${'bump'}     | ${'0.12.1'} | ${'0.12.1'}
    ${'1.2, 2'}     | ${'bump'}     | ${'2.5.0'}  | ${'2.5.0'}
    ${'>= 1.2.3'}   | ${'bump'}     | ${'2.0.0'}  | ${'>= 2.0.0'}
  `(
    'getNewValue($currentValue, $rangeStrategy, $newVersion) === $expected (bump)',
    ({ currentValue, rangeStrategy, newVersion, expected }) => {
      expect(
        julia.getNewValue({
          currentValue,
          rangeStrategy,
          newVersion,
        }),
      ).toBe(expected);
    },
  );

  // `replace` only rewrites when the new release does not already fit.
  it.each`
    currentValue    | rangeStrategy | newVersion  | expected
    ${'^1.2.3'}     | ${'replace'}  | ${'1.5.0'}  | ${'^1.2.3'}
    ${'^1.2.3'}     | ${'replace'}  | ${'2.0.0'}  | ${'^2.0.0'}
    ${'^1.2'}       | ${'replace'}  | ${'2.0.0'}  | ${'^2.0'}
    ${'1.2.3'}      | ${'replace'}  | ${'2.0.0'}  | ${'2.0.0'}
    ${'=1.2.3'}     | ${'replace'}  | ${'2.0.0'}  | ${'=2.0.0'}
    ${'= 1.2.3'}    | ${'replace'}  | ${'2.0.0'}  | ${'= 2.0.0'}
    ${'0.10, 0.11'} | ${'replace'}  | ${'0.12.1'} | ${'0.12'}
    ${'>= 1.2.3'}   | ${'replace'}  | ${'2.0.0'}  | ${'>= 1.2.3'}
    ${'< 2.0.0'}    | ${'replace'}  | ${'2.0.0'}  | ${'< 3.0.0'}
  `(
    'getNewValue($currentValue, $rangeStrategy, $newVersion) === $expected (replace)',
    ({ currentValue, rangeStrategy, newVersion, expected }) => {
      expect(
        julia.getNewValue({
          currentValue,
          rangeStrategy,
          newVersion,
        }),
      ).toBe(expected);
    },
  );

  // `widen` appends a specifier in ascending position, keeping the entry's
  // style; hyphen ranges and whole-entry pins are not appended to.
  it.each`
    currentValue        | rangeStrategy | newVersion    | expected
    ${'0.10, 0.11'}     | ${'widen'}    | ${'0.12.1'}   | ${'0.10, 0.11, 0.12'}
    ${'0.10, 0.11'}     | ${'widen'}    | ${'0.11.5'}   | ${'0.10, 0.11'}
    ${'1.2.3'}          | ${'widen'}    | ${'1.5.0'}    | ${'1.2.3'}
    ${'>= 1.2.3'}       | ${'widen'}    | ${'2.0.0'}    | ${'>= 1.2.3'}
    ${'0.10,0.11'}      | ${'widen'}    | ${'0.12.1'}   | ${'0.10,0.11,0.12'}
    ${'1.2.3'}          | ${'widen'}    | ${'2.0.0'}    | ${'1.2.3, 2.0'}
    ${'0.0.3'}          | ${'widen'}    | ${'0.0.4'}    | ${'0.0.3, 0.0.4'}
    ${'0.12'}           | ${'widen'}    | ${'0.11.0'}   | ${'0.11, 0.12'}
    ${'1.2.3 - 4.5'}    | ${'widen'}    | ${'5.0.0'}    | ${'1.2.3 - 4.5'}
    ${'1.2.3 - 4.5, 5'} | ${'widen'}    | ${'6.0.0'}    | ${'1.2.3 - 4.5, 5, 6'}
    ${'<0.0.1, 1'}      | ${'widen'}    | ${'2.0.0'}    | ${'<0.0.1, 1, 2'}
    ${'<0.0.1, 0.10'}   | ${'widen'}    | ${'0.12.1'}   | ${'<0.0.1, 0.10, 0.12'}
    ${'1, 2'}           | ${'widen'}    | ${'3.1.0'}    | ${'1, 2, 3'}
    ${'0'}              | ${'widen'}    | ${'1.0.0'}    | ${'0, 1'}
    ${'0.12, 5'}        | ${'widen'}    | ${'0.13.0'}   | ${'0.12, 0.13, 5'}
    ${'=0.12.0'}        | ${'widen'}    | ${'0.12.5'}   | ${'=0.12.5'}
    ${'=0.12.0, 1'}     | ${'widen'}    | ${'0.12.5'}   | ${'=0.12.0, 0.12, 1'}
    ${'0.10, 0.11'}     | ${'widen'}    | ${'0.12.1+3'} | ${'0.10, 0.11, 0.12'}
  `(
    'getNewValue($currentValue, $rangeStrategy, $newVersion) === $expected (widen)',
    ({ currentValue, rangeStrategy, newVersion, expected }) => {
      expect(
        julia.getNewValue({
          currentValue,
          rangeStrategy,
          newVersion,
        }),
      ).toBe(expected);
    },
  );

  // A compat entry takes digits only, so a prerelease tag or a JLL build
  // number is dropped from the target before it is written.
  it.each`
    currentValue | rangeStrategy | newVersion      | expected
    ${'1.6.9'}   | ${'bump'}     | ${'1.6.10+0'}   | ${'1.6.10'}
    ${'=1.6.9'}  | ${'replace'}  | ${'1.6.10+0'}   | ${'=1.6.10'}
    ${'^1.6'}    | ${'replace'}  | ${'2.0.0+2'}    | ${'^2.0'}
    ${'1.2.3'}   | ${'bump'}     | ${'1.3.0-rc.1'} | ${'1.3.0'}
    ${'=1.2.3'}  | ${'replace'}  | ${'1.3.0-rc.1'} | ${'=1.3.0'}
  `(
    'getNewValue($currentValue, $rangeStrategy, $newVersion) === $expected (compat value)',
    ({ currentValue, rangeStrategy, newVersion, expected }) => {
      expect(
        julia.getNewValue({
          currentValue,
          rangeStrategy,
          newVersion,
        }),
      ).toBe(expected);
    },
  );

  it('getNewValue returns currentValue for empty/star input', () => {
    expect(
      julia.getNewValue({
        currentValue: '',
        rangeStrategy: 'bump',
        newVersion: '1.2.4',
      }),
    ).toBe('');
    expect(
      julia.getNewValue({
        currentValue: '*',
        rangeStrategy: 'bump',
        newVersion: '1.2.4',
      }),
    ).toBe('*');
  });
});
