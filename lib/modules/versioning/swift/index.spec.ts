import swift from '.';

const {
  getNewValue,
  isValid,
  isVersion,
  minSatisfyingVersion,
  getSatisfyingVersion,
  isLessThanRange,
  matches,
} = swift;

describe('modules/versioning/swift/index', () => {
  it.each`
    version            | expected
    ${'from: "1.2.3"'} | ${false}
    ${'1.2.3'}         | ${true}
  `('isVersion("$version") === $expected', ({ version, expected }) => {
    expect(!!isVersion(version)).toBe(expected);
  });

  it.each`
    version                    | expected
    ${'from: "1.2.3"'}         | ${true}
    ${'from : "1.2.3"'}        | ${true}
    ${'from : "1.2.3.4.5"'}    | ${false}
    ${'from:"1.2.3"'}          | ${true}
    ${' from:"1.2.3" '}        | ${true}
    ${' from : "1.2.3" '}      | ${true}
    ${'"1.2.3"..."1.2.4"'}     | ${true}
    ${' "1.2.3" ... "1.2.4" '} | ${true}
    ${'"1.2.3"...'}            | ${true}
    ${'"1.2.3.4.5"...'}        | ${false}
    ${' "1.2.3" ... '}         | ${true}
    ${'..."1.2.4"'}            | ${true}
    ${' ... "1.2.4" '}         | ${true}
    ${'"1.2.3"..<"1.2.4"'}     | ${true}
    ${'"1.2.3.4.5"..<"1.2.4"'} | ${false}
    ${' "1.2.3" ..< "1.2.4" '} | ${true}
    ${'..<"1.2.4"'}            | ${true}
    ${' ..< "1.2.4" '}         | ${true}
    ${'17.04.0'}               | ${false}
    ${'1.2.3'}                 | ${true}
    ${'v1.2.3'}                | ${true}
    ${'1.2.3-foo'}             | ${true}
    ${'1.2.3foo'}              | ${false}
    ${'~1.2.3'}                | ${false}
    ${'^1.2.3'}                | ${false}
    ${'from: "1.2.3"'}         | ${true}
    ${'"1.2.3"..."1.2.4"'}     | ${true}
    ${'"1.2.3"..."1.2.4"'}     | ${true}
    ${'"1.2.3"..<"1.2.4"'}     | ${true}
    ${'"1.2.3"..<"1.2.4"'}     | ${true}
    ${'..."1.2.3"'}            | ${true}
    ${'..<"1.2.4"'}            | ${true}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(!!isValid(version)).toBe(expected);
  });

  it.each`
    versions                          | range           | expected
    ${['1.2.3', '1.2.4', '1.2.5']}    | ${'..<"1.2.4"'} | ${'1.2.3'}
    ${['v1.2.3', 'v1.2.4', 'v1.2.5']} | ${'..<"1.2.4"'} | ${'1.2.3'}
    ${['v1.2.3', 'v1.2.4', 'v1.2.5']} | ${''}           | ${null}
  `(
    'minSatisfyingVersion($versions, "$range") === "$expected"',
    ({ versions, range, expected }) => {
      expect(minSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    versions                          | range           | expected
    ${['1.2.3', '1.2.4', '1.2.5']}    | ${'..<"1.2.4"'} | ${'1.2.3'}
    ${['v1.2.3', 'v1.2.4', 'v1.2.5']} | ${'..<"1.2.4"'} | ${'1.2.3'}
    ${['1.2.3', '1.2.4', '1.2.5']}    | ${'..."1.2.4"'} | ${'1.2.4'}
    ${['1.2.3', '1.2.4', '1.2.5']}    | ${''}           | ${null}
  `(
    'getSatisfyingVersion($versions, "$range") === "$expected"',
    ({ versions, range, expected }) => {
      expect(getSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    version     | range           | expected
    ${'1.2.3'}  | ${'..."1.2.4"'} | ${false}
    ${'v1.2.3'} | ${'..."1.2.4"'} | ${false}
    ${'1.2.3'}  | ${'"1.2.4"...'} | ${true}
    ${'v1.2.3'} | ${'"1.2.4"...'} | ${true}
    ${'v1.2.3'} | ${''}           | ${false}
  `(
    'isLessThanRange("$version", "$range") === "$expected"',
    ({ version, range, expected }) => {
      expect(isLessThanRange?.(version, range)).toBe(expected);
    },
  );

  it.each`
    version     | range           | expected
    ${'1.2.4'}  | ${'..."1.2.4"'} | ${true}
    ${'v1.2.4'} | ${'..."1.2.4"'} | ${true}
    ${'1.2.4'}  | ${'..."1.2.3"'} | ${false}
    ${'v1.2.4'} | ${'..."1.2.3"'} | ${false}
    ${'v1.2.4'} | ${''}           | ${false}
  `(
    'matches("$version", "$range") === "$expected"',
    ({ version, range, expected }) => {
      expect(matches(version, range)).toBe(expected);
    },
  );

  it.each`
    currentValue           | rangeStrategy | currentVersion | newVersion  | expected
    ${'1.2.3'}             | ${'auto'}     | ${'1.2.3'}     | ${'1.2.4'}  | ${'1.2.4'}
    ${'1.2.3'}             | ${'auto'}     | ${'1.2.3'}     | ${'v1.2.4'} | ${'1.2.4'}
    ${'from: "1.2.3"'}     | ${'auto'}     | ${'1.2.3'}     | ${'1.2.4'}  | ${'from: "1.2.4"'}
    ${'from: "1.2.3"'}     | ${'auto'}     | ${'1.2.3'}     | ${'v1.2.4'} | ${'from: "1.2.4"'}
    ${'from: "1.2.2"'}     | ${'auto'}     | ${'1.2.3'}     | ${'1.2.4'}  | ${'from: "1.2.4"'}
    ${'from: "1.2.2"'}     | ${'auto'}     | ${'1.2.3'}     | ${'v1.2.4'} | ${'from: "1.2.4"'}
    ${'"1.2.3"...'}        | ${'auto'}     | ${'1.2.3'}     | ${'1.2.4'}  | ${'"1.2.4"...'}
    ${'"1.2.3"...'}        | ${'auto'}     | ${'1.2.3'}     | ${'v1.2.4'} | ${'"1.2.4"...'}
    ${'"1.2.3"..."1.2.4"'} | ${'auto'}     | ${'1.2.3'}     | ${'1.2.5'}  | ${'"1.2.3"..."1.2.5"'}
    ${'"1.2.3"..."1.2.4"'} | ${'auto'}     | ${'1.2.3'}     | ${'v1.2.5'} | ${'"1.2.3"..."1.2.5"'}
    ${'"1.2.3"..<"1.2.4"'} | ${'auto'}     | ${'1.2.3'}     | ${'1.2.5'}  | ${'"1.2.3"..<"1.2.5"'}
    ${'"1.2.3"..<"1.2.4"'} | ${'auto'}     | ${'1.2.3'}     | ${'v1.2.5'} | ${'"1.2.3"..<"1.2.5"'}
    ${'..."1.2.4"'}        | ${'auto'}     | ${'1.2.3'}     | ${'1.2.5'}  | ${'..."1.2.5"'}
    ${'..."1.2.4"'}        | ${'auto'}     | ${'1.2.3'}     | ${'v1.2.5'} | ${'..."1.2.5"'}
    ${'..<"1.2.4"'}        | ${'auto'}     | ${'1.2.3'}     | ${'1.2.5'}  | ${'..<"1.2.5"'}
    ${'..<"1.2.4"'}        | ${'auto'}     | ${'1.2.3'}     | ${'v1.2.5'} | ${'..<"1.2.5"'}
  `(
    'getNewValue("$currentValue", "$rangeStrategy", "$currentVersion", "$newVersion") === "$expected"',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      expect(
        getNewValue({
          currentValue,
          rangeStrategy,
          currentVersion,
          newVersion,
        }),
      ).toBe(expected);
    },
  );
});
