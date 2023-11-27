import { api as hexScheme } from '.';

describe('modules/versioning/hex/index', () => {
  it.each`
    version    | range                     | expected
    ${'4.2.0'} | ${'~> 4.0'}               | ${true}
    ${'2.1.0'} | ${'~> 2.0.0'}             | ${false}
    ${'2.0.0'} | ${'>= 2.0.0 and < 2.1.0'} | ${true}
    ${'2.1.0'} | ${'== 2.0.0 or < 2.1.0'}  | ${false}
    ${'1.9.4'} | ${'== 1.9.4'}             | ${true}
    ${'1.9.5'} | ${'== 1.9.4'}             | ${false}
  `(
    'matches("$version", "$range") === $expected',
    ({ version, range, expected }) => {
      expect(hexScheme.matches(version, range)).toBe(expected);
    },
  );

  it.each`
    versions                                         | range         | expected
    ${['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0']} | ${'~> 4.0'}   | ${'4.2.0'}
    ${['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0']} | ${'~> 4.0.0'} | ${'4.0.0'}
  `(
    'getSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(hexScheme.getSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    input                      | expected
    ${'>= 1.0.0 and <= 2.0.0'} | ${true}
    ${'>= 1.0.0 or <= 2.0.0'}  | ${true}
    ${'!= 1.0.0'}              | ${true}
    ${'== 1.0.0'}              | ${true}
  `('isValid("$input") === $expected', ({ input, expected }) => {
    const res = !!hexScheme.isValid(input);
    expect(res).toBe(expected);
  });

  it.each`
    version    | range                      | expected
    ${'0.1.0'} | ${'>= 1.0.0 and <= 2.0.0'} | ${true}
    ${'1.9.0'} | ${'>= 1.0.0 and <= 2.0.0'} | ${false}
    ${'0.9.0'} | ${'>= 1.0.0 or >= 2.0.0'}  | ${true}
    ${'1.9.0'} | ${'>= 1.0.0 or >= 2.0.0'}  | ${false}
  `(
    'isLessThanRange($version, $range) === $expected',
    ({ version, range, expected }) => {
      expect(hexScheme.isLessThanRange?.(version, range)).toBe(expected);
    },
  );

  it.each`
    versions                                | range         | expected
    ${['0.4.0', '0.5.0', '4.2.0', '5.0.0']} | ${'~> 4.0'}   | ${'4.2.0'}
    ${['0.4.0', '0.5.0', '4.2.0', '5.0.0']} | ${'~> 4.0.0'} | ${null}
  `(
    'minSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(hexScheme.minSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    currentValue               | rangeStrategy | currentVersion | newVersion | expected
    ${'== 1.2.3'}              | ${'pin'}      | ${'1.2.3'}     | ${'2.0.7'} | ${'== 2.0.7'}
    ${'== 3.6.1'}              | ${'bump'}     | ${'3.6.1'}     | ${'3.6.2'} | ${'== 3.6.2'}
    ${'== 3.6.1'}              | ${'replace'}  | ${'3.6.1'}     | ${'3.6.2'} | ${'== 3.6.2'}
    ${'~> 1.2'}                | ${'replace'}  | ${'1.2.3'}     | ${'2.0.7'} | ${'~> 2.0'}
    ${'~> 1.2'}                | ${'pin'}      | ${'1.2.3'}     | ${'2.0.7'} | ${'== 2.0.7'}
    ${'~> 1.2'}                | ${'bump'}     | ${'1.2.3'}     | ${'2.0.7'} | ${'~> 2.0'}
    ${'~> 1.2'}                | ${'bump'}     | ${'1.2.3'}     | ${'1.3.1'} | ${'~> 1.3'}
    ${'~> 1.2.0'}              | ${'replace'}  | ${'1.2.3'}     | ${'2.0.7'} | ${'~> 2.0.0'}
    ${'~> 1.2.0'}              | ${'pin'}      | ${'1.2.3'}     | ${'2.0.7'} | ${'== 2.0.7'}
    ${'~> 1.2.0'}              | ${'bump'}     | ${'1.2.3'}     | ${'2.0.7'} | ${'~> 2.0.7'}
    ${'>= 1.0.0 and <= 2.0.0'} | ${'widen'}    | ${'1.2.3'}     | ${'2.0.7'} | ${'>= 1.0.0 and <= 2.0.7'}
    ${'>= 1.0.0 and <= 2.0.0'} | ${'replace'}  | ${'1.2.3'}     | ${'2.0.7'} | ${'<= 2.0.7'}
    ${'>= 1.0.0 and <= 2.0.0'} | ${'pin'}      | ${'1.2.3'}     | ${'2.0.7'} | ${'== 2.0.7'}
    ${'>= 1.0.0 or <= 2.0.0'}  | ${'widen'}    | ${'1.2.3'}     | ${'2.0.7'} | ${'>= 1.0.0 or <= 2.0.0'}
    ${'>= 1.0.0 or <= 2.0.0'}  | ${'replace'}  | ${'1.2.3'}     | ${'2.0.7'} | ${'<= 2.0.7'}
    ${'>= 1.0.0 or <= 2.0.0'}  | ${'pin'}      | ${'1.2.3'}     | ${'2.0.7'} | ${'== 2.0.7'}
    ${'~> 0.4'}                | ${'replace'}  | ${'0.4.2'}     | ${'0.6.0'} | ${'~> 0.6'}
  `(
    'getNewValue("$currentValue", "$rangeStrategy", "$currentVersion", "$newVersion") === "$expected"',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      const res = hexScheme.getNewValue({
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
      });
      expect(res).toEqual(expected);
    },
  );
});
