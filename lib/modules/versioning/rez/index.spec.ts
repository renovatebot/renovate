import semver from '../semver';
import { api as versioning } from '.';

describe('modules/versioning/rez/index', () => {
  it.each`
    version       | equal    | expected
    ${'1'}        | ${'1'}   | ${true}
    ${'1.0'}      | ${'1'}   | ${true}
    ${'1.0.0'}    | ${'1'}   | ${true}
    ${'1.9.0'}    | ${'1.9'} | ${true}
    ${'1'}        | ${'2'}   | ${false}
    ${'1.9.1'}    | ${'1.9'} | ${false}
    ${'1.9-beta'} | ${'1.9'} | ${false}
  `(
    'equals("$version", "$equal") === $expected',
    ({ version, equal, expected }) => {
      expect(versioning.equals(version, equal)).toBe(expected);
    },
  );

  it.each`
    version    | expected
    ${'1'}     | ${1}
    ${'1.9'}   | ${1}
    ${'1.9.0'} | ${1}
  `('getMajor("$version") === $expected', ({ version, expected }) => {
    expect(versioning.getMajor(version)).toEqual(expected);
  });

  it.each`
    version    | expected
    ${'1'}     | ${0}
    ${'1.9'}   | ${9}
    ${'1.9.0'} | ${9}
  `('getMinor("$version") === $expected', ({ version, expected }) => {
    expect(versioning.getMinor(version)).toEqual(expected);
  });

  it.each`
    version    | expected
    ${'1'}     | ${0}
    ${'1.9'}   | ${0}
    ${'1.9.0'} | ${0}
    ${'1.9.4'} | ${4}
  `('getPatch("$version") === $expected', ({ version, expected }) => {
    expect(versioning.getPatch(version)).toEqual(expected);
  });

  it.each`
    version     | other         | expected
    ${'2'}      | ${'1'}        | ${true}
    ${'2.0'}    | ${'1'}        | ${true}
    ${'2.0.0'}  | ${'1'}        | ${true}
    ${'1.10.0'} | ${'1.9'}      | ${true}
    ${'1.9'}    | ${'1.9-beta'} | ${true}
    ${'1'}      | ${'1'}        | ${false}
    ${'1.0'}    | ${'1'}        | ${false}
    ${'1.0.0'}  | ${'1'}        | ${false}
    ${'1.9.0'}  | ${'1.9'}      | ${false}
  `(
    'isGreaterThan("$version", "$other") === $expected',
    ({ version, other, expected }) => {
      expect(versioning.isGreaterThan(version, other)).toEqual(expected);
    },
  );

  it.each`
    version         | expected
    ${'1'}          | ${true}
    ${'1.9'}        | ${true}
    ${'1.9.0'}      | ${true}
    ${'1.9.4'}      | ${true}
    ${'1.9.4-beta'} | ${false}
  `('isStable("$version") === $expected', ({ version, expected }) => {
    expect(versioning.isStable(version)).toEqual(expected);
  });

  it.each`
    input               | expected
    ${'1.2.3..1.2.4'}   | ${true}
    ${'1.2..1.3'}       | ${true}
    ${'1.2..2'}         | ${true}
    ${'1..3'}           | ${true}
    ${'17.04.0'}        | ${false}
    ${'1.2.3'}          | ${true}
    ${'v1.2.3'}         | ${true}
    ${'1.2.3-foo'}      | ${true}
    ${'1.2.3foo'}       | ${false}
    ${'1.2.3+'}         | ${true}
    ${'1.2.3+<2'}       | ${true}
    ${'1.2.3..1.2.4'}   | ${true}
    ${'<=1.2.3'}        | ${true}
    ${'<=2.0.0,>1.0.0'} | ${true}
    ${'==1.2.3'}        | ${true}
  `('isValid("$input") === $expected', ({ input, expected }) => {
    const res = !!versioning.isValid(input);
    expect(res).toBe(expected);
  });

  it.each`
    input      | expected
    ${'1.2.3'} | ${true}
  `('isVersion("$input") === $expected', ({ input, expected }) => {
    const res = !!versioning.isVersion(input);
    expect(res).toBe(expected);
  });

  it.each`
    input              | expected
    ${'1.2.3'}         | ${true}
    ${'1.2.3-alpha.1'} | ${true}
    ${'==1.2.3'}       | ${true}
    ${'1.*'}           | ${false}
  `('isSingleVersion("$input") === $expected', ({ input, expected }) => {
    const res = !!versioning.isSingleVersion(input);
    expect(res).toBe(expected);
  });

  it.each`
    versions                                | range             | expected
    ${['1.2.3', '1.2.4', '1.2.5']}          | ${'1.2.3..1.2.4'} | ${'1.2.3'}
    ${['0.4.0', '0.5.0', '4.2.0', '5.0.0']} | ${'4'}            | ${'4.2.0'}
    ${['0.4.0', '0.5.0', '4.2.0', '5.0.0']} | ${'4..5'}         | ${'4.2.0'}
    ${['0.4.0', '0.5.0', '4.2.0', '5.0.0']} | ${'4..5.0'}       | ${'4.2.0'}
    ${['0.4.0', '0.5.0', '4.2.0', '5.0.0']} | ${'4.2..5.0'}     | ${'4.2.0'}
    ${['0.4.0', '0.5.0', '4.2.0', '5.0.0']} | ${'4.2.0..5.0'}   | ${'4.2.0'}
    ${['0.4.0', '0.5.0', '4.2.0', '5.0.0']} | ${'4.2.0..5.0.0'} | ${'4.2.0'}
  `(
    'minSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(versioning.minSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    versions                       | range             | expected
    ${['1.2.3', '1.2.4', '1.2.5']} | ${'1.2.3..1.2.4'} | ${'1.2.3'}
  `(
    'getSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(versioning.getSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    version    | range             | expected
    ${'1.2.3'} | ${'1.2.3..1.2.4'} | ${false}
    ${'1.2.3'} | ${'1.2.4..1.2.5'} | ${true}
    ${'0.9.0'} | ${'1.0.0..2.0.0'} | ${true}
    ${'1.9.0'} | ${'1.0.0..2.0.0'} | ${false}
  `(
    'isLessThanRange($version, "$range") === $expected',
    ({ version, range, expected }) => {
      expect(versioning.isLessThanRange?.(version, range)).toBe(expected);
    },
  );

  it.each`
    version    | range             | expected
    ${'1.2.3'} | ${'1.2.3..1.2.4'} | ${true}
    ${'1.2.4'} | ${'1.2.2..1.2.3'} | ${false}
    ${'4.2.0'} | ${'4.2.0..5.0.0'} | ${true}
    ${'4.2'}   | ${'4.2.0..5.0.0'} | ${true}
    ${'4.2'}   | ${'4.2..5'}       | ${true}
    ${'4.2.0'} | ${'4.2..5'}       | ${true}
    ${'4.2.0'} | ${'4.2..5.0'}     | ${true}
    ${'4.2.0'} | ${'4.2..5.0.0'}   | ${true}
    ${'4.2.0'} | ${'2.0..3.0'}     | ${false}
    ${'4.2.2'} | ${'4.2.0..4.2.4'} | ${true}
    ${'1.4'}   | ${'1.4'}          | ${true}
  `(
    'matches($version, "$range") === $expected',
    ({ version, range, expected }) => {
      expect(versioning.matches(version, range)).toBe(expected);
    },
  );

  it.each`
    a          | b
    ${'1.1.1'} | ${'1.2.3'}
    ${'1.2.3'} | ${'1.3.4'}
    ${'2.0.1'} | ${'1.2.3'}
    ${'1.2.3'} | ${'0.9.5'}
  `(
    'rez.sortVersions("$a", "$b") === semver.sortVersions("$a", "$b")',
    ({ a, b }) => {
      const dockerSorted = versioning.sortVersions(a, b);
      const semverSorted = semver.sortVersions(a, b);
      expect(dockerSorted).toBe(semverSorted);
    },
  );

  it.each`
    currentValue         | rangeStrategy | currentVersion | newVersion | expected
    ${'==1.2.3'}         | ${'replace'}  | ${'1.2.3'}     | ${'1.2.4'} | ${'==1.2.4'}
    ${'1.2.3'}           | ${'auto'}     | ${'1.2.3'}     | ${'1.2.4'} | ${'1.2.4'}
    ${'1.2.3'}           | ${'bump'}     | ${'1.2.3'}     | ${'1.2.4'} | ${'1.2.4'}
    ${'1.2.3'}           | ${'replace'}  | ${'1.2.3'}     | ${'1.2.4'} | ${'1.2.4'}
    ${'1.2.3'}           | ${'widen'}    | ${'1.2.3'}     | ${'1.2.4'} | ${'1.2.4'}
    ${'7..8'}            | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'8..9'}
    ${'7.2..8'}          | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'8.2..9'}
    ${'7.2.3..8'}        | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'8.2.5..9'}
    ${'7..8.0'}          | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'8..8.3'}
    ${'7.2..8.0'}        | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'8.2..8.3'}
    ${'7.2.3..8.0'}      | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'8.2.5..8.3'}
    ${'7..8.0.0'}        | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'8..8.3'}
    ${'7.2..8.0.0'}      | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'8.2..8.3'}
    ${'7.2.3..8.0.0'}    | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'8.2.5..8.3.0'}
    ${'5..6'}            | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'5.2.5..6'}
    ${'5.2..6'}          | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'5.2.5..6'}
    ${'5.2.3..6'}        | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'5.2.5..6'}
    ${'5..6.0'}          | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'6.2.5..6.3'}
    ${'5.2..6.0'}        | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'6.2.5..6.3'}
    ${'5.2.3..6.0'}      | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'5.2.5..6.0'}
    ${'5..6.0.0'}        | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'5.2.5..6.0.0'}
    ${'5.2..6.0.0'}      | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'5.2.5..6.0.0'}
    ${'5.2.3..6.0.0'}    | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'5.2.5..6.0.0'}
    ${'1..2'}            | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'1..3'}
    ${'1.2..2'}          | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'1.2..3'}
    ${'1.2..2.0'}        | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'1.2..2.3'}
    ${'1.2.3..2.0'}      | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'1.2.3..2.3'}
    ${'1.2.3..2.0.0'}    | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'1.2.3..2.3.0'}
    ${'7+'}              | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'7+'}
    ${'7.2+'}            | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'7.2+'}
    ${'7.2.3+'}          | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'7.2.3+'}
    ${'5+'}              | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'6.2.5+'}
    ${'5.2+'}            | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'6.2.5+'}
    ${'5.2.3+'}          | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'6.2.5+'}
    ${'1+'}              | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'1+'}
    ${'1.2+'}            | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'1.2+'}
    ${'1.2.3+'}          | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'1.2.3+'}
    ${'>=7'}             | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>=7'}
    ${'>=7.2'}           | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>=7.2'}
    ${'>=7.2.3'}         | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>=7.2.3'}
    ${'>=5'}             | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'>=6.2.5'}
    ${'>=5.2'}           | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'>=6.2.5'}
    ${'>=5.2.3'}         | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'>=6.2.5'}
    ${'>=1'}             | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>=1'}
    ${'>=1.2'}           | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>=1.2'}
    ${'>=1.2.3'}         | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>=1.2.3'}
    ${'>7'}              | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>7'}
    ${'>7.2'}            | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>7.2'}
    ${'>7.2.2'}          | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>7.2.2'}
    ${'>5'}              | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'>5'}
    ${'>5.2'}            | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'>5.2'}
    ${'>5.2.3'}          | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'>5.2.3'}
    ${'>1'}              | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>1'}
    ${'>1.2'}            | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>1.2'}
    ${'>1.2.3'}          | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>1.2.3'}
    ${'<=8'}             | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<=8.2.5'}
    ${'<=7.3'}           | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<=8.2.5'}
    ${'<=7.2.3'}         | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<=8.2.5'}
    ${'<=6'}             | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'<=6.2.5'}
    ${'<=5.3'}           | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'<=6.2.5'}
    ${'<=5.2.3'}         | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'<=6.2.5'}
    ${'<=2'}             | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'<=2.2.5'}
    ${'<=1.3'}           | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'<=2.2.5'}
    ${'<=1.2.3'}         | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'<=2.2.5'}
    ${'<8'}              | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<9'}
    ${'<7.3'}            | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<8.3'}
    ${'<7.2.4'}          | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<8.2.6'}
    ${'<6'}              | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'<7'}
    ${'<5.3'}            | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'<6.3'}
    ${'<5.2.4'}          | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'<6.2.6'}
    ${'<2'}              | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'<3'}
    ${'<1.3'}            | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'<2.3'}
    ${'<1.2.4'}          | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'<2.2.6'}
    ${'7+<8'}            | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'8+<9'}
    ${'7.2+<8'}          | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'8.2+<9'}
    ${'7.2.3+<8'}        | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'8.2.5+<9'}
    ${'7+<8.0'}          | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'8+<8.3'}
    ${'7.2+<8.0'}        | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'8.2+<8.3'}
    ${'7.2.3+<8.0'}      | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'8.2.5+<8.3'}
    ${'7+<8.0.0'}        | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'8+<8.3'}
    ${'7.2+<8.0.0'}      | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'8.2+<8.3'}
    ${'7.2.3+<8.0.0'}    | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'8.2.5+<8.3.0'}
    ${'5+<6'}            | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'5.2.5+<6'}
    ${'5.2+<6'}          | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'5.2.5+<6'}
    ${'5.2.3+<6'}        | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'5.2.5+<6'}
    ${'5+<6.0'}          | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'6.2.5+<6.3'}
    ${'5.2+<6.0'}        | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'6.2.5+<6.3'}
    ${'5.2.3+<6.0'}      | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'5.2.5+<6.0'}
    ${'5+<6.0.0'}        | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'5.2.5+<6.0.0'}
    ${'5.2+<6.0.0'}      | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'5.2.5+<6.0.0'}
    ${'5.2.3+<6.0.0'}    | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'5.2.5+<6.0.0'}
    ${'1+<2'}            | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'1+<3'}
    ${'1.2+<2'}          | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'1.2+<3'}
    ${'1.2+<2.0'}        | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'1.2+<2.3'}
    ${'1.2.3+<2.0'}      | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'1.2.3+<2.3'}
    ${'1.2.3+<2.0.0'}    | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'1.2.3+<2.3.0'}
    ${'>=7,<8'}          | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>=8,<9'}
    ${'>=7.2,<8'}        | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>=8.2,<9'}
    ${'>=7.2.3,<8'}      | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>=8.2.5,<9'}
    ${'>=7,<8.0'}        | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>=8,<8.3'}
    ${'>=7.2,<8.0'}      | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>=8.2,<8.3'}
    ${'>=7.2.3,<8.0'}    | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>=8.2.5,<8.3'}
    ${'>=7,<8.0.0'}      | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>=8,<8.3'}
    ${'>=7.2,<8.0.0'}    | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>=8.2,<8.3'}
    ${'>=7.2.3,<8.0.0'}  | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>=8.2.5,<8.3.0'}
    ${'>=5,<6'}          | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>=5.2.5,<6'}
    ${'>=5.2,<6'}        | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>=5.2.5,<6'}
    ${'>=5.2.3,<6'}      | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>=5.2.5,<6'}
    ${'>=5,<6.0'}        | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'>=6.2.5,<6.3'}
    ${'>=5.2,<6.0'}      | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'>=6.2.5,<6.3'}
    ${'>=5.2.3,<6.0'}    | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>=5.2.5,<6.0'}
    ${'>=5,<6.0.0'}      | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>=5.2.5,<6.0.0'}
    ${'>=5.2,<6.0.0'}    | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>=5.2.5,<6.0.0'}
    ${'>=5.2.3,<6.0.0'}  | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>=5.2.5,<6.0.0'}
    ${'>=1,<2'}          | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>=1,<3'}
    ${'>=1.2,<2'}        | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>=1.2,<3'}
    ${'>=1.2,<2.0'}      | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>=1.2,<2.3'}
    ${'>=1.2.3,<2.0'}    | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>=1.2.3,<2.3'}
    ${'>=1.2.3,<2.0.0'}  | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>=1.2.3,<2.3.0'}
    ${'>=7<8'}           | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>=8<9'}
    ${'>=7.2<8'}         | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>=8.2<9'}
    ${'>=7.2.3<8'}       | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>=8.2.5<9'}
    ${'>=7<8.0'}         | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>=8<8.3'}
    ${'>=7.2<8.0'}       | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>=8.2<8.3'}
    ${'>=7.2.3<8.0'}     | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>=8.2.5<8.3'}
    ${'>=7<8.0.0'}       | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>=8<8.3'}
    ${'>=7.2<8.0.0'}     | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>=8.2<8.3'}
    ${'>=7.2.3<8.0.0'}   | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>=8.2.5<8.3.0'}
    ${'>=5<6'}           | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>=5.2.5<6'}
    ${'>=5.2<6'}         | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>=5.2.5<6'}
    ${'>=5.2.3<6'}       | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>=5.2.5<6'}
    ${'>=5<6.0'}         | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'>=6.2.5<6.3'}
    ${'>=5.2<6.0'}       | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'>=6.2.5<6.3'}
    ${'>=5.2.3<6.0'}     | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>=5.2.5<6.0'}
    ${'>=5<6.0.0'}       | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>=5.2.5<6.0.0'}
    ${'>=5.2<6.0.0'}     | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>=5.2.5<6.0.0'}
    ${'>=5.2.3<6.0.0'}   | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>=5.2.5<6.0.0'}
    ${'>=1<2'}           | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>=1<3'}
    ${'>=1.2<2'}         | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>=1.2<3'}
    ${'>=1.2<2.0'}       | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>=1.2<2.3'}
    ${'>=1.2.3<2.0'}     | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>=1.2.3<2.3'}
    ${'>=1.2.3<2.0.0'}   | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>=1.2.3<2.3.0'}
    ${'>6,<8'}           | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>8,<9'}
    ${'>7.1,<8'}         | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>8.2,<9'}
    ${'>7.2.0,<8'}       | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>8.2,<9'}
    ${'>6,<8.0'}         | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>8,<8.3'}
    ${'>7.1,<8.0'}       | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>8.2,<8.3'}
    ${'>7.2.0,<8.0'}     | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>8.2,<8.3'}
    ${'>6,<8.0.0'}       | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>8,<8.3'}
    ${'>7.1,<8.0.0'}     | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>8.2,<8.3'}
    ${'>7.2.0,<8.0.0'}   | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>8.2,<8.3.0'}
    ${'>4,<6'}           | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>4,<6'}
    ${'>5.1,<6'}         | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>5.1,<6'}
    ${'>5.2.0,<6'}       | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>5.2.0,<6'}
    ${'>5,<6.0'}         | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'>5,<6.3'}
    ${'>5.1,<6.0'}       | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'>5.1,<6.3'}
    ${'>5.2.0,<6.0'}     | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>5.2.0,<6.0'}
    ${'>5,<6.0.0'}       | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>5,<6.0.0'}
    ${'>5.1,<6.0.0'}     | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>5.1,<6.0.0'}
    ${'>5.2.0,<6.0.0'}   | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>5.2.0,<6.0.0'}
    ${'>1,<2'}           | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>1,<3'}
    ${'>1.1,<2'}         | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>1.1,<3'}
    ${'>1.1,<2.0'}       | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>1.1,<2.3'}
    ${'>1.2.0,<2.0'}     | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>1.2.0,<2.3'}
    ${'>1.2.0,<2.0.0'}   | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>1.2.0,<2.3.0'}
    ${'>6<8'}            | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>8<9'}
    ${'>7.1<8'}          | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>8.2<9'}
    ${'>7.2.0<8'}        | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>8.2<9'}
    ${'>6<8.0'}          | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>8<8.3'}
    ${'>7.1<8.0'}        | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>8.2<8.3'}
    ${'>7.2.0<8.0'}      | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>8.2<8.3'}
    ${'>6<8.0.0'}        | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>8<8.3'}
    ${'>7.1<8.0.0'}      | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>8.2<8.3'}
    ${'>7.2.0<8.0.0'}    | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'>8.2<8.3.0'}
    ${'>4<6'}            | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>4<6'}
    ${'>5.1<6'}          | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>5.1<6'}
    ${'>5.2.0<6'}        | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>5.2.0<6'}
    ${'>5<6.0'}          | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'>5<6.3'}
    ${'>5.1<6.0'}        | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'>5.1<6.3'}
    ${'>5.2.0<6.0'}      | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>5.2.0<6.0'}
    ${'>4<6.0.0'}        | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>4<6.0.0'}
    ${'>5.1<6.0.0'}      | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>5.1<6.0.0'}
    ${'>5.2.0<6.0.0'}    | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'>5.2.0<6.0.0'}
    ${'>1<2'}            | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>1<3'}
    ${'>1.1<2'}          | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>1.1<3'}
    ${'>1.1<2.0'}        | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>1.1<2.3'}
    ${'>1.2.0<2.0'}      | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>1.2.0<2.3'}
    ${'>1.2.0<2.0.0'}    | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'>1.2.0<2.3.0'}
    ${'<8,>=7'}          | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<9,>=8'}
    ${'<8,>=7.2'}        | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<9,>=8.2'}
    ${'<8,>=7.2.3'}      | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<9,>=8.2.5'}
    ${'<8.0,>=7'}        | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<8.3,>=8'}
    ${'<8.0,>=7.2'}      | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<8.3,>=8.2'}
    ${'<8.0,>=7.2.3'}    | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<8.3,>=8.2.5'}
    ${'<8.0.0,>=7'}      | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<8.3,>=8'}
    ${'<8.0.0,>=7.2'}    | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<8.3,>=8.2'}
    ${'<8.0.0,>=7.2.3'}  | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<8.3.0,>=8.2.5'}
    ${'<6,>=5'}          | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'<6,>=5.2.5'}
    ${'<6,>=5.2'}        | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'<6,>=5.2.5'}
    ${'<6,>=5.2.3'}      | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'<6,>=5.2.5'}
    ${'<6.0,>=5'}        | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'<6.3,>=6.2.5'}
    ${'<6.0,>=5.2'}      | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'<6.3,>=6.2.5'}
    ${'<6.0,>=5.2.3'}    | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'<6.0,>=5.2.5'}
    ${'<6.0.0,>=5'}      | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'<6.0.0,>=5.2.5'}
    ${'<6.0.0,>=5.2'}    | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'<6.0.0,>=5.2.5'}
    ${'<6.0.0,>=5.2.3'}  | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'<6.0.0,>=5.2.5'}
    ${'<2,>=1'}          | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'<3,>=1'}
    ${'<2,>=1.2'}        | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'<3,>=1.2'}
    ${'<2.0,>=1.2'}      | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'<2.3,>=1.2'}
    ${'<2.0,>=1.2.3'}    | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'<2.3,>=1.2.3'}
    ${'<2.0.0,>=1.2.3'}  | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'<2.3.0,>=1.2.3'}
    ${'<8,>6'}           | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<9,>8'}
    ${'<8,>7.1'}         | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<9,>8.2'}
    ${'<8,>7.2.0'}       | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<9,>8.2'}
    ${'<8.0,>6'}         | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<8.3,>8'}
    ${'<8.0,>7.1'}       | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<8.3,>8.2'}
    ${'<8.0,>7.2.0'}     | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<8.3,>8.2'}
    ${'<8.0.0,>6'}       | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<8.3,>8'}
    ${'<8.0.0,>7.1'}     | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<8.3,>8.2'}
    ${'<8.0.0,>7.2.0'}   | ${'replace'}  | ${'7.2.3'}     | ${'8.2.5'} | ${'<8.3.0,>8.2'}
    ${'<6,>4'}           | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'<6,>4'}
    ${'<6,>5.1'}         | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'<6,>5.1'}
    ${'<6,>5.2.0'}       | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'<6,>5.2.0'}
    ${'<6.0,>5'}         | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'<6.3,>5'}
    ${'<6.0,>5.1'}       | ${'bump'}     | ${'5.2.3'}     | ${'6.2.5'} | ${'<6.3,>5.1'}
    ${'<6.0,>5.2.0'}     | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'<6.0,>5.2.0'}
    ${'<6.0.0,>5'}       | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'<6.0.0,>5'}
    ${'<6.0.0,>5.1'}     | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'<6.0.0,>5.1'}
    ${'<6.0.0,>5.2.0'}   | ${'bump'}     | ${'5.2.3'}     | ${'5.2.5'} | ${'<6.0.0,>5.2.0'}
    ${'<2,>1'}           | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'<3,>1'}
    ${'<2,>1.1'}         | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'<3,>1.1'}
    ${'<2.0,>1.1'}       | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'<2.3,>1.1'}
    ${'<2.0,>1.2.0'}     | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'<2.3,>1.2.0'}
    ${'<2.0.0,>1.2.0'}   | ${'widen'}    | ${'1.2.3'}     | ${'2.2.5'} | ${'<2.3.0,>1.2.0'}
    ${'<=1.2.5, >1.2.0'} | ${'widen'}    | ${'1.2.3'}     | ${'1.2.4'} | ${null}
  `(
    'getNewValue($currentValue, $rangeStrategy, $currentVersion, $newVersion, $expected) === $expected',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      const res = versioning.getNewValue({
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
      });
      expect(res).toBe(expected);
    },
  );

  it.each`
    version    | expected
    ${'1.2.0'} | ${true}
  `('isCompatible("$version") === $expected', ({ version, expected }) => {
    expect(versioning.isCompatible(version)).toBe(expected);
  });
});
