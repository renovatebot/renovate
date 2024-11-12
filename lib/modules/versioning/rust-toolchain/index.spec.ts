import { api } from './index';

describe('modules/versioning/rust-toolchain/index', () => {
  const versioning = api;

  it.each`
    version      | expected
    ${'1.82.0'}  | ${true}
    ${'1.82.42'} | ${true}
    ${'1.82'}    | ${true}
  `('isStable("$version") === $expected', ({ version, expected }) => {
    expect(versioning.isStable(version)).toBe(expected);
  });

  it.each`
    version                                                        | expected
    ${'1.82.0'}                                                    | ${true}
    ${'1.82.42'}                                                   | ${true}
    ${'1.82'}                                                      | ${true}
    ${'v1.0'}                                                      | ${false}
    ${'1'}                                                         | ${false}
    ${'2'}                                                         | ${false}
    ${'10'}                                                        | ${false}
    ${'nightly'}                                                   | ${false}
    ${'nightly-06"ENV GRADLE_VERSION=(?<currentValue>.*)-12-2024'} | ${false}
    ${'beta'}                                                      | ${false}
    ${'beta-06-12-2024'}                                           | ${false}
    ${'stable'}                                                    | ${false}
    ${'stable-06-12-2024'}                                         | ${false}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(versioning.isValid(version)).toBe(expected);
  });

  it.each`
    version      | major | minor | patch
    ${'1.82.0'}  | ${1}  | ${82} | ${0}
    ${'1.82.4'}  | ${1}  | ${82} | ${4}
    ${'1.82.42'} | ${1}  | ${82} | ${42}
    ${'1.82'}    | ${1}  | ${82} | ${null}
  `(
    'getMajor, getMinor, getPatch for "$version"',
    ({ version, major, minor, patch }) => {
      expect(versioning.getMajor(version)).toBe(major);
      expect(versioning.getMinor(version)).toBe(minor);
      expect(versioning.getPatch(version)).toBe(patch);
    },
  );

  it.each`
    version      | other        | expected
    ${'1.82.0'}  | ${'1.82.0'}  | ${true}
    ${'1.82.1'}  | ${'1.82.1'}  | ${true}
    ${'1.82.42'} | ${'1.82.42'} | ${true}
    ${'1.82.1'}  | ${'1.82.4'}  | ${false}
  `(
    'equals("$version", "$other") === $expected',
    ({ version, other, expected }) => {
      expect(versioning.equals(version, other)).toBe(expected);
    },
  );

  it.each`
    version      | range        | expected
    ${'1.82.0'}  | ${'1.82.0'}  | ${true}
    ${'1.82.1'}  | ${'1.82.1'}  | ${true}
    ${'1.82.42'} | ${'1.82.42'} | ${true}
    ${'1.82.0'}  | ${'1.82'}    | ${true}
    ${'1.82.1'}  | ${'1.82'}    | ${true}
    ${'1.82.1'}  | ${'1.83'}    | ${false}
    ${'1.82.1'}  | ${'1.81'}    | ${false}
    ${'1.82.1'}  | ${'1.82.4'}  | ${false}
  `(
    'matches("$version", "$range") === $expected',
    ({ version, range, expected }) => {
      expect(versioning.matches(version, range)).toBe(expected);
    },
  );

  it.each`
    version     | other       | expected
    ${'1.82.0'} | ${'1.83.0'} | ${false}
    ${'1.83.0'} | ${'1.82.0'} | ${true}
    ${'1.82.0'} | ${'1.82.1'} | ${false}
    ${'1.82.1'} | ${'1.82.0'} | ${true}
    ${'2.82.0'} | ${'1.82.1'} | ${true}
    ${'1.82.1'} | ${'2.82.0'} | ${false}
    ${'2.82.0'} | ${'1.82.0'} | ${true}
    ${'1.82.0'} | ${'2.82.0'} | ${false}
  `(
    'isGreaterThan("$version", "$other") === $expected',
    ({ version, other, expected }) => {
      expect(versioning.isGreaterThan(version, other)).toBe(expected);
    },
  );

  it('sorts versions in an ascending order', () => {
    expect(
      ['1.82.4', '1.82.0', '2.80.5', '1.83.1'].sort((a, b) =>
        versioning.sortVersions(a, b),
      ),
    ).toEqual(['1.82.0', '1.82.4', '1.83.1', '2.80.5']);
  });
});
