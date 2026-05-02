import { api as julia } from './index.ts';

describe('modules/versioning/julia/index', () => {
  it.each`
    version    | expected
    ${'1'}     | ${false}
    ${'1.2'}   | ${false}
    ${'1.2.3'} | ${true}
  `('isVersion("$version") === $expected', ({ version, expected }) => {
    expect(!!julia.isVersion(version)).toBe(expected);
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
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(!!julia.isValid(version)).toBe(expected);
  });

  // Caret examples from
  // https://pkgdocs.julialang.org/v1/compatibility/#Caret-specifiers
  it.each`
    version    | range       | expected
    ${'1.2.3'} | ${'^1.2.3'} | ${true}
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
  `(
    'matches("$version", "$range") === $expected (tilde)',
    ({ version, range, expected }) => {
      expect(julia.matches(version, range)).toBe(expected);
    },
  );

  // Bare version = caret default; comma = union; ≥ synonym; equality; hyphen.
  it.each`
    version     | range                 | expected
    ${'1.2.5'}  | ${'1.2.3'}            | ${true}
    ${'2.0.0'}  | ${'1.2.3'}            | ${false}
    ${'1.5.0'}  | ${'1.2'}              | ${true}
    ${'2.0.0'}  | ${'1.2, 2'}           | ${true}
    ${'2.9.9'}  | ${'1.2, 2'}           | ${true}
    ${'3.0.0'}  | ${'1.2, 2'}           | ${false}
    ${'0.5.0'}  | ${'0.2, 1'}           | ${false}
    ${'1.0.0'}  | ${'0.2, 1'}           | ${true}
    ${'0.2.0'}  | ${'0.2, 1'}           | ${true}
    ${'1.2.3'}  | ${'=1.2.3'}           | ${true}
    ${'1.2.4'}  | ${'=1.2.3'}           | ${false}
    ${'0.10.1'} | ${'=0.10.1, =0.10.3'} | ${true}
    ${'0.10.2'} | ${'=0.10.1, =0.10.3'} | ${false}
    ${'0.10.3'} | ${'=0.10.1, =0.10.3'} | ${true}
    ${'1.2.3'}  | ${'>= 1.2.3'}         | ${true}
    ${'9.9.9'}  | ${'>= 1.2.3'}         | ${true}
    ${'1.2.2'}  | ${'>= 1.2.3'}         | ${false}
    ${'1.2.3'}  | ${'≥ 1.2.3'}          | ${true}
    ${'1.2.2'}  | ${'≥ 1.2.3'}          | ${false}
    ${'1.2.2'}  | ${'< 1.2.3'}          | ${true}
    ${'1.2.3'}  | ${'< 1.2.3'}          | ${false}
    ${'1.2.3'}  | ${'1.2.3 - 4.5.6'}    | ${true}
    ${'4.5.6'}  | ${'1.2.3 - 4.5.6'}    | ${true}
    ${'4.5.7'}  | ${'1.2.3 - 4.5.6'}    | ${false}
    ${'4.5.6'}  | ${'1.2.3 - 4.5'}      | ${true}
    ${'4.6.0'}  | ${'1.2.3 - 4.5'}      | ${false}
  `(
    'matches("$version", "$range") === $expected',
    ({ version, range, expected }) => {
      expect(julia.matches(version, range)).toBe(expected);
    },
  );

  it.each`
    versions                                                  | range       | expected
    ${['0.4.0', '0.5.0', '4.0.0', '4.2.0', '4.2.1', '5.0.0']} | ${'^4.2'}   | ${'4.2.1'}
    ${['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0']}          | ${'4.2'}    | ${'4.2.0'}
    ${['1.0.0', '1.5.0', '2.0.0', '3.0.0']}                   | ${'1.2, 2'} | ${'2.0.0'}
  `(
    'getSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(julia.getSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    versions                                | range       | expected
    ${['1.0.0', '1.5.0', '2.0.0', '3.0.0']} | ${'1.2, 2'} | ${'1.5.0'}
  `(
    'minSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(julia.minSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    constraint   | expected
    ${'=1.2.3'}  | ${true}
    ${'= 1.2.3'} | ${true}
    ${'1.2.3'}   | ${false}
    ${'^1.2.3'}  | ${false}
    ${'~1.2.3'}  | ${false}
  `(
    'isSingleVersion("$constraint") === $expected',
    ({ constraint, expected }) => {
      expect(!!julia.isSingleVersion(constraint)).toBe(expected);
    },
  );

  it.each`
    version    | range       | expected
    ${'1.0.0'} | ${'^1.2.3'} | ${true}
    ${'1.2.3'} | ${'^1.2.3'} | ${false}
    ${'2.0.0'} | ${'^1.2.3'} | ${false}
    ${'0.0.2'} | ${'^0.0.3'} | ${true}
    ${'0.0.3'} | ${'^0.0.3'} | ${false}
  `(
    'isLessThanRange("$version", "$range") === $expected',
    ({ version, range, expected }) => {
      expect(julia.isLessThanRange?.(version, range)).toBe(expected);
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
  `(
    'isBreaking("$current", "$version") === $expected',
    ({ current, version, expected }) => {
      expect(julia.isBreaking?.(current, version)).toBe(expected);
    },
  );

  it('getPinnedValue formats with `=`', () => {
    expect(julia.getPinnedValue?.('1.2.3')).toBe('=1.2.3');
  });

  it.each`
    currentValue | rangeStrategy | currentVersion | newVersion | expected
    ${'1.2.3'}   | ${'bump'}     | ${'1.2.3'}     | ${'1.2.4'} | ${'1.2.4'}
    ${'^1.2.3'}  | ${'bump'}     | ${'1.2.3'}     | ${'1.2.4'} | ${'^1.2.4'}
    ${'^1.2.3'}  | ${'replace'}  | ${'1.2.3'}     | ${'1.5.0'} | ${'^1.2.3'}
    ${'^1.2.3'}  | ${'replace'}  | ${'1.2.3'}     | ${'2.0.0'} | ${'^2.0.0'}
    ${'^1.2'}    | ${'replace'}  | ${'1.2.3'}     | ${'2.0.0'} | ${'^2.0'}
    ${'1.2.3'}   | ${'replace'}  | ${'1.2.3'}     | ${'2.0.0'} | ${'2.0.0'}
    ${'=1.2.3'}  | ${'replace'}  | ${'1.2.3'}     | ${'2.0.0'} | ${'=2.0.0'}
    ${'= 1.2.3'} | ${'replace'}  | ${'1.2.3'}     | ${'2.0.0'} | ${'= 2.0.0'}
  `(
    'getNewValue($currentValue, $rangeStrategy, $newVersion) === $expected',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      expect(
        julia.getNewValue?.({
          currentValue,
          rangeStrategy,
          currentVersion,
          newVersion,
        }),
      ).toBe(expected);
    },
  );

  it('getNewValue returns currentValue for empty/star input', () => {
    expect(
      julia.getNewValue?.({
        currentValue: '',
        rangeStrategy: 'bump',
        currentVersion: '1.2.3',
        newVersion: '1.2.4',
      }),
    ).toBe('');
    expect(
      julia.getNewValue?.({
        currentValue: '*',
        rangeStrategy: 'bump',
        currentVersion: '1.2.3',
        newVersion: '1.2.4',
      }),
    ).toBe('*');
  });
});
