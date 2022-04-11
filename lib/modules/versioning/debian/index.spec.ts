import { api as debian } from '.';

describe('modules/versioning/debian/index', () => {
  test.each`
    version           | expected
    ${undefined}      | ${false}
    ${null}           | ${false}
    ${''}             | ${false}
    ${'buzz'}         | ${true}
    ${'rex'}          | ${true}
    ${'bo'}           | ${true}
    ${'hamm'}         | ${true}
    ${'slink'}        | ${true}
    ${'potato'}       | ${true}
    ${'woody'}        | ${true}
    ${'sarge'}        | ${true}
    ${'etch'}         | ${true}
    ${'lenny'}        | ${true}
    ${'squeeze'}      | ${true}
    ${'wheezy'}       | ${true}
    ${'jessie'}       | ${true}
    ${'stretch'}      | ${true}
    ${'buster'}       | ${true}
    ${'bullseye'}     | ${true}
    ${'bookworm'}     | ${false}
    ${'trixie'}       | ${false}
    ${'sid'}          | ${false}
    ${'1.1'}          | ${true}
    ${'1.2'}          | ${true}
    ${'1.3'}          | ${true}
    ${'2'}            | ${true}
    ${'2.1'}          | ${true}
    ${'2.2'}          | ${true}
    ${'3'}            | ${true}
    ${'4'}            | ${true}
    ${'5'}            | ${true}
    ${'6'}            | ${true}
    ${'7'}            | ${true}
    ${'8'}            | ${true}
    ${'9'}            | ${true}
    ${'10'}           | ${true}
    ${'10-slim'}      | ${false}
    ${'11'}           | ${true}
    ${'12'}           | ${false}
    ${'13'}           | ${false}
    ${'sid'}          | ${false}
    ${'stable'}       | ${true}
    ${'oldstable'}    | ${true}
    ${'oldoldstable'} | ${true}
    ${'experimental'} | ${false}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(debian.isValid(version)).toBe(expected);
  });

  test.each`
    version           | range        | expected
    ${undefined}      | ${undefined} | ${false}
    ${null}           | ${undefined} | ${false}
    ${''}             | ${undefined} | ${false}
    ${'7'}            | ${undefined} | ${true}
    ${'11'}           | ${undefined} | ${true}
    ${'12'}           | ${undefined} | ${false}
    ${'stable'}       | ${undefined} | ${true}
    ${'oldstable'}    | ${undefined} | ${true}
    ${'oldoldstable'} | ${undefined} | ${true}
    ${'wheezy'}       | ${undefined} | ${true}
    ${'bullseye'}     | ${undefined} | ${true}
    ${'bookworm'}     | ${undefined} | ${false}
  `(
    'isCompatible("$version") === $expected',
    ({ version, range, expected }) => {
      const res = debian.isCompatible(version, range);
      expect(res).toBe(expected);
    }
  );

  test.each`
    version      | expected
    ${undefined} | ${false}
    ${null}      | ${false}
    ${''}        | ${false}
    ${'6'}       | ${true}
    ${'>=6'}     | ${false}
  `('isSingleVersion("$version") === $expected', ({ version, expected }) => {
    expect(debian.isSingleVersion(version)).toBe(expected);
  });

  test.each`
    version           | expected
    ${undefined}      | ${false}
    ${null}           | ${false}
    ${''}             | ${false}
    ${'buzz'}         | ${false}
    ${'rex'}          | ${false}
    ${'bo'}           | ${false}
    ${'hamm'}         | ${false}
    ${'slink'}        | ${false}
    ${'potato'}       | ${false}
    ${'woody'}        | ${false}
    ${'sarge'}        | ${false}
    ${'etch'}         | ${false}
    ${'lenny'}        | ${false}
    ${'squeeze'}      | ${false}
    ${'wheezy'}       | ${false}
    ${'jessie'}       | ${false}
    ${'stretch'}      | ${true}
    ${'buster'}       | ${true}
    ${'bullseye'}     | ${true}
    ${'bookworm'}     | ${false}
    ${'trixie'}       | ${false}
    ${'sid'}          | ${false}
    ${'1.1'}          | ${false}
    ${'1.2'}          | ${false}
    ${'1.3'}          | ${false}
    ${'2'}            | ${false}
    ${'2.1'}          | ${false}
    ${'2.2'}          | ${false}
    ${'3'}            | ${false}
    ${'4'}            | ${false}
    ${'5'}            | ${false}
    ${'6'}            | ${false}
    ${'7'}            | ${false}
    ${'8'}            | ${false}
    ${'9'}            | ${true}
    ${'10'}           | ${true}
    ${'11'}           | ${true}
    ${'12'}           | ${false}
    ${'13'}           | ${false}
    ${'sid'}          | ${false}
    ${'experimental'} | ${false}
    ${'stable'}       | ${true}
    ${'oldstable'}    | ${true}
    ${'oldoldstable'} | ${true}
  `('isStable("$version") === $expected', ({ version, expected }) => {
    expect(debian.isStable(version)).toBe(expected);
  });

  test.each`
    version           | expected
    ${undefined}      | ${false}
    ${null}           | ${false}
    ${''}             | ${false}
    ${'02.10'}        | ${false}
    ${'04.10'}        | ${false}
    ${'05.04'}        | ${false}
    ${'6.06'}         | ${false}
    ${'8.04'}         | ${false}
    ${'9.04'}         | ${false}
    ${'buzz'}         | ${true}
    ${'rex'}          | ${true}
    ${'bo'}           | ${true}
    ${'hamm'}         | ${true}
    ${'slink'}        | ${true}
    ${'potato'}       | ${true}
    ${'woody'}        | ${true}
    ${'sarge'}        | ${true}
    ${'etch'}         | ${true}
    ${'lenny'}        | ${true}
    ${'squeeze'}      | ${true}
    ${'wheezy'}       | ${true}
    ${'jessie'}       | ${true}
    ${'stretch'}      | ${true}
    ${'buster'}       | ${true}
    ${'bullseye'}     | ${true}
    ${'bookworm'}     | ${false}
    ${'trixie'}       | ${false}
    ${'sid'}          | ${false}
    ${'1.1'}          | ${true}
    ${'1.2'}          | ${true}
    ${'1.3'}          | ${true}
    ${'2'}            | ${true}
    ${'2.1'}          | ${true}
    ${'2.2'}          | ${true}
    ${'3'}            | ${true}
    ${'4'}            | ${true}
    ${'5'}            | ${true}
    ${'6'}            | ${true}
    ${'7'}            | ${true}
    ${'8'}            | ${true}
    ${'9'}            | ${true}
    ${'10'}           | ${true}
    ${'11'}           | ${true}
    ${'12'}           | ${false}
    ${'13'}           | ${false}
    ${'sid'}          | ${false}
    ${'experimental'} | ${false}
    ${'Bookworm'}     | ${false}
    ${'Sid'}          | ${false}
    ${'Potato-'}      | ${false}
    ${'Woody'}        | ${false}
    ${'stable'}       | ${true}
    ${'oldstable'}    | ${true}
    ${'oldoldstable'} | ${true}
  `('isVersion("$version") === $expected', ({ version, expected }) => {
    expect(debian.isVersion(version)).toBe(expected);
  });

  test.each`
    version           | major   | minor   | patch
    ${undefined}      | ${null} | ${null} | ${null}
    ${null}           | ${null} | ${null} | ${null}
    ${''}             | ${null} | ${null} | ${null}
    ${'42'}           | ${null} | ${null} | ${null}
    ${'2020.04'}      | ${null} | ${null} | ${null}
    ${'3.1'}          | ${3}    | ${1}    | ${null}
    ${'1.1'}          | ${1}    | ${1}    | ${null}
    ${'7'}            | ${7}    | ${null} | ${null}
    ${'8'}            | ${8}    | ${null} | ${null}
    ${'9'}            | ${9}    | ${null} | ${null}
    ${'10'}           | ${10}   | ${null} | ${null}
    ${'oldoldstable'} | ${9}    | ${null} | ${null}
    ${'oldstable'}    | ${10}   | ${null} | ${null}
    ${'stable'}       | ${11}   | ${null} | ${null}
  `(
    'getMajor, getMinor, getPatch for "$version"',
    ({ version, major, minor, patch }) => {
      expect(debian.getMajor(version)).toBe(major);
      expect(debian.getMinor(version)).toBe(minor);
      expect(debian.getPatch(version)).toBe(patch);
    }
  );

  test.each`
    a                 | b                 | expected
    ${'woody'}        | ${'sarge'}        | ${false}
    ${'lenny'}        | ${'3'}            | ${false}
    ${'lenny'}        | ${'5'}            | ${true}
    ${'squeeze'}      | ${'6'}            | ${true}
    ${'10'}           | ${'buster'}       | ${true}
    ${'6'}            | ${'squeeze'}      | ${true}
    ${'buster'}       | ${'10'}           | ${true}
    ${'oldoldstable'} | ${'9'}            | ${true}
    ${'oldstable'}    | ${'10'}           | ${true}
    ${'stable'}       | ${'11'}           | ${true}
    ${'9'}            | ${'oldoldstable'} | ${true}
    ${'10'}           | ${'oldstable'}    | ${true}
    ${'11'}           | ${'stable'}       | ${true}
  `('equals($a, $b) === $expected', ({ a, b, expected }) => {
    expect(debian.equals(a, b)).toBe(expected);
  });

  test.each`
    a                 | b                 | expected
    ${'5'}            | ${'6'}            | ${false}
    ${'6'}            | ${'5'}            | ${true}
    ${'5'}            | ${'10'}           | ${false}
    ${'11'}           | ${'10'}           | ${true}
    ${'5'}            | ${'6'}            | ${false}
    ${'11'}           | ${'1.1'}          | ${true}
    ${'xxx'}          | ${'yyy'}          | ${false}
    ${'yyy'}          | ${'xxx'}          | ${false}
    ${'lenny'}        | ${'squeeze'}      | ${false}
    ${'squeeze'}      | ${'lenny'}        | ${true}
    ${'lenny'}        | ${'buster'}       | ${false}
    ${'bookworm'}     | ${'etch'}         | ${true}
    ${'sarge'}        | ${'bo'}           | ${true}
    ${'bullseye'}     | ${'rex'}          | ${true}
    ${'buzz'}         | ${'jessie'}       | ${false}
    ${'oldoldstable'} | ${'8'}            | ${true}
    ${'oldstable'}    | ${'oldoldstable'} | ${true}
    ${'stable'}       | ${'oldstable'}    | ${true}
    ${'11'}           | ${'oldoldstable'} | ${true}
    ${'10'}           | ${'oldstable'}    | ${false}
    ${'9'}            | ${'stable'}       | ${false}
  `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(debian.isGreaterThan(a, b)).toBe(expected);
  });

  test.each`
    versions                                            | range         | expected
    ${['8', '9', '10', '11']}                           | ${'2020.04'}  | ${null}
    ${['8', '9', '10', '11']}                           | ${'foobar'}   | ${null}
    ${['8', '9', '10', '11']}                           | ${'11'}       | ${'11'}
    ${['8', '9', '10', '11']}                           | ${'10'}       | ${'10'}
    ${['8', '9', '10', '11']}                           | ${'4'}        | ${null}
    ${['jessie', 'stretch', 'buster', 'bullseye']}      | ${'2020.04'}  | ${null}
    ${['jessie', 'stretch', 'buster', 'bullseye']}      | ${'foobar'}   | ${null}
    ${['jessie', 'stretch', 'buster', 'bullseye']}      | ${'bullseye'} | ${'bullseye'}
    ${['jessie', 'stretch', 'buster', 'bullseye']}      | ${'buster'}   | ${'buster'}
    ${['jessie', 'stretch', 'buster', 'stable']}        | ${'stable'}   | ${'stable'}
    ${['jessie', 'stretch', 'oldstable', 'bullseye']}   | ${'buster'}   | ${'oldstable'}
    ${['jessie', 'oldoldstable', 'buster', 'bullseye']} | ${'warty'}    | ${null}
  `(
    'getSatisfyingVersion($versions, "$range") === "$expected"',
    ({ versions, range, expected }) => {
      expect(debian.getSatisfyingVersion(versions, range)).toBe(expected);
    }
  );

  test.each`
    versions                                            | range         | expected
    ${['8', '9', '10', '11']}                           | ${'2020.04'}  | ${null}
    ${['8', '9', '10', '11']}                           | ${'foobar'}   | ${null}
    ${['8', '9', '10', '11']}                           | ${'11'}       | ${'11'}
    ${['8', '9', '10', '11']}                           | ${'10'}       | ${'10'}
    ${['8', '9', '10', '11']}                           | ${'4'}        | ${null}
    ${['jessie', 'stretch', 'buster', 'bullseye']}      | ${'2020.04'}  | ${null}
    ${['jessie', 'stretch', 'buster', 'bullseye']}      | ${'foobar'}   | ${null}
    ${['jessie', 'stretch', 'buster', 'bullseye']}      | ${'bullseye'} | ${'bullseye'}
    ${['jessie', 'stretch', 'buster', 'bullseye']}      | ${'buster'}   | ${'buster'}
    ${['jessie', 'stretch', 'buster', 'bullseye']}      | ${'warty'}    | ${null}
    ${['jessie', 'stretch', 'buster', 'stable']}        | ${'stable'}   | ${'stable'}
    ${['jessie', 'stretch', 'oldstable', 'bullseye']}   | ${'buster'}   | ${'oldstable'}
    ${['jessie', 'oldoldstable', 'buster', 'bullseye']} | ${'warty'}    | ${null}
  `(
    'minSatisfyingVersion($versions, "$range") === "$expected"',
    ({ versions, range, expected }) => {
      expect(debian.minSatisfyingVersion(versions, range)).toBe(expected);
    }
  );

  test.each`
    currentValue      | rangeStrategy | currentVersion | newVersion    | expected
    ${undefined}      | ${undefined}  | ${undefined}   | ${'foobar'}   | ${'foobar'}
    ${'stretch'}      | ${undefined}  | ${undefined}   | ${'11'}       | ${'bullseye'}
    ${'stretch'}      | ${undefined}  | ${undefined}   | ${'bullseye'} | ${'bullseye'}
    ${'stretch'}      | ${undefined}  | ${undefined}   | ${'stable'}   | ${'bullseye'}
    ${'9'}            | ${undefined}  | ${undefined}   | ${'11'}       | ${'11'}
    ${'oldoldstable'} | ${undefined}  | ${undefined}   | ${'11'}       | ${'stable'}
    ${'oldstable'}    | ${undefined}  | ${undefined}   | ${'11'}       | ${'stable'}
    ${'9'}            | ${undefined}  | ${undefined}   | ${'stable'}   | ${'11'}
  `(
    'getNewValue("$currentValue", "$rangeStrategy", "$currentVersion", "$newVersion") === "$expected"',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      expect(
        debian.getNewValue({
          currentValue,
          rangeStrategy,
          currentVersion,
          newVersion,
        })
      ).toBe(expected);
    }
  );

  test.each`
    a                 | b                 | expected
    ${'woody'}        | ${'sarge'}        | ${-1}
    ${'lenny'}        | ${'3'}            | ${1}
    ${'3'}            | ${'lenny'}        | ${-1}
    ${'lenny'}        | ${'5'}            | ${0}
    ${'squeeze'}      | ${'6'}            | ${0}
    ${'10'}           | ${'buster'}       | ${0}
    ${'6'}            | ${'squeeze'}      | ${0}
    ${'buster'}       | ${'10'}           | ${0}
    ${'oldoldstable'} | ${'8'}            | ${1}
    ${'oldstable'}    | ${'oldoldstable'} | ${1}
    ${'stable'}       | ${'oldstable'}    | ${1}
    ${'11'}           | ${'oldoldstable'} | ${1}
    ${'10'}           | ${'oldstable'}    | ${0}
    ${'9'}            | ${'stable'}       | ${-1}
  `('debian.sortVersions($a, $b) === $expected ', ({ a, b, expected }) => {
    expect(debian.sortVersions(a, b)).toEqual(expected);
  });

  test.each`
    version | range        | expected
    ${'10'} | ${'10-slim'} | ${true}
    ${'11'} | ${'11'}      | ${true}
    ${'11'} | ${'11.0'}    | ${true}
  `(
    'matches("$version", "$range") === "$expected"',
    ({ version, range, expected }) => {
      expect(debian.matches(version, range)).toBe(expected);
    }
  );
});
