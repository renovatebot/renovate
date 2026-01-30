import rustReleaseChannel from './index.ts';

describe('modules/versioning/rust-release-channel/index', () => {
  test.each`
    input                              | expected
    ${'stable'}                        | ${true}
    ${'beta'}                          | ${true}
    ${'nightly'}                       | ${true}
    ${'1.82.0'}                        | ${true}
    ${'1.82'}                          | ${true}
    ${'1.83.0-beta.5'}                 | ${true}
    ${'1.83.0-beta'}                   | ${true}
    ${'nightly-2025-11-24'}            | ${true}
    ${'stable-x86_64-pc-windows-msvc'} | ${true}
    ${''}                              | ${false}
    ${'invalid'}                       | ${false}
    ${'1.82.0.0'}                      | ${false}
    ${'a.b.c'}                         | ${false}
  `('isValid("$input") === $expected', ({ input, expected }) => {
    expect(rustReleaseChannel.isValid(input)).toBe(expected);
  });

  test.each`
    input                   | expected
    ${'1.82.0'}             | ${true}
    ${'1.83.0-beta.5'}      | ${true}
    ${'nightly-2025-11-24'} | ${true}
    ${'stable'}             | ${false}
    ${'beta'}               | ${false}
    ${'nightly'}            | ${false}
    ${'1.82'}               | ${false}
    ${'1.83.0-beta'}        | ${false}
    ${undefined}            | ${false}
    ${null}                 | ${false}
    ${'invalid'}            | ${false}
  `('isVersion("$input") === $expected', ({ input, expected }) => {
    expect(rustReleaseChannel.isVersion(input)).toBe(expected);
  });

  test.each`
    input                   | expected
    ${'1.82.0'}             | ${true}
    ${'1.83.0-beta.5'}      | ${true}
    ${'nightly-2025-11-24'} | ${true}
    ${'stable'}             | ${false}
    ${'beta'}               | ${false}
    ${'nightly'}            | ${false}
    ${'1.82'}               | ${false}
    ${'1.83.0-beta'}        | ${false}
  `('isSingleVersion("$input") === $expected', ({ input, expected }) => {
    expect(rustReleaseChannel.isSingleVersion(input)).toBe(expected);
  });

  test.each`
    version                 | expected
    ${'1.82.0'}             | ${true}
    ${'1.0.0'}              | ${true}
    ${'2.5.10'}             | ${true}
    ${'1.83.0-beta.5'}      | ${false}
    ${'1.83.0-beta'}        | ${false}
    ${'nightly-2025-11-24'} | ${false}
    ${'stable'}             | ${false}
    ${'1.82'}               | ${false}
    ${'invalid'}            | ${false}
  `('isStable("$version") === $expected', ({ version, expected }) => {
    expect(rustReleaseChannel.isStable(version)).toBe(expected);
  });

  test.each`
    a                       | b                       | expected
    ${'1.82'}               | ${'1.82'}               | ${true}
    ${'1.82.0'}             | ${'1.82.0'}             | ${true}
    ${'1.83.0-beta'}        | ${'1.83.0-beta'}        | ${true}
    ${'1.83.0-beta.5'}      | ${'1.83.0-beta.5'}      | ${true}
    ${'nightly-2025-11-24'} | ${'nightly-2025-11-24'} | ${true}
    ${'stable'}             | ${'stable'}             | ${true}
    ${'invalid'}            | ${'invalid'}            | ${false}
    ${'1.82.0'}             | ${'1.83.0'}             | ${false}
    ${'1.83.0-beta.5'}      | ${'1.83.0-beta.1'}      | ${false}
    ${'nightly-2025-11-24'} | ${'nightly-2025-11-23'} | ${false}
  `('equals("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(rustReleaseChannel.equals(a, b)).toBe(expected);
  });

  test.each`
    a                       | b                       | expected
    ${'nightly-2025-11-24'} | ${'1.82.0'}             | ${true}
    ${'nightly-2025-11-24'} | ${'nightly-2025-11-23'} | ${true}
    ${'nightly-2025-11-24'} | ${'nightly-2024-11-24'} | ${true}
    ${'nightly-2025-11-24'} | ${'nightly-2025-10-24'} | ${true}
    ${'1.83.0'}             | ${'1.82.0'}             | ${true}
    ${'1.83.0-beta.5'}      | ${'1.83.0-beta.1'}      | ${true}
    ${'1.83.0'}             | ${'1.83.0-beta.1'}      | ${true}
    ${'1.84.0-beta.1'}      | ${'1.83.0-beta.1'}      | ${true}
    ${'2.0.0'}              | ${'1.99.0'}             | ${true}
    ${'1.83'}               | ${'1.82'}               | ${true}
    ${'1.82.1'}             | ${'1.82'}               | ${true}
    ${'1.82.0'}             | ${'1.83.0'}             | ${false}
    ${'1.82'}               | ${'1.83'}               | ${false}
    ${'1.82'}               | ${'1.82.0'}             | ${false}
    ${'1.82'}               | ${'1.82.1'}             | ${false}
    ${'1.83.0-beta.1'}      | ${'1.83.0-beta.5'}      | ${false}
    ${'nightly-2025-11-23'} | ${'nightly-2025-11-24'} | ${false}
    ${'nightly-2024-11-24'} | ${'nightly-2025-11-24'} | ${false}
    ${'nightly-2025-10-24'} | ${'nightly-2025-11-24'} | ${false}
    ${'1.82.0'}             | ${'nightly-2025-11-24'} | ${false}
    ${'1.83.0-beta.1'}      | ${'1.83.0'}             | ${false}
    ${'1.99.0'}             | ${'2.0.0'}              | ${false}
  `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(rustReleaseChannel.isGreaterThan(a, b)).toBe(expected);
  });

  test.each`
    a                       | b                       | expected
    ${'1.82.0'}             | ${'1.82.0'}             | ${0}
    ${'1.83.0-beta.5'}      | ${'1.83.0-beta.5'}      | ${0}
    ${'nightly-2025-11-24'} | ${'nightly-2025-11-24'} | ${0}
    ${'foo'}                | ${'foo'}                | ${0}
    ${'1.83.0'}             | ${'1.82.0'}             | ${1}
    ${'2.0.0'}              | ${'1.99.0'}             | ${1}
    ${'1.83.0-beta.5'}      | ${'1.83.0-beta.1'}      | ${4}
    ${'1.83.0'}             | ${'1.83.0-beta.1'}      | ${1}
    ${'nightly-2025-11-24'} | ${'1.82.0'}             | ${1}
    ${'nightly-2025-11-24'} | ${'nightly-2025-11-23'} | ${1}
    ${'foo'}                | ${'bar'}                | ${1}
    ${'1.82.0'}             | ${'1.83.0'}             | ${-1}
    ${'1.99.0'}             | ${'2.0.0'}              | ${-1}
    ${'1.83.0-beta.1'}      | ${'1.83.0-beta.5'}      | ${-4}
    ${'1.83.0-beta.1'}      | ${'1.83.0'}             | ${-1}
    ${'1.82.0'}             | ${'nightly-2025-11-24'} | ${-1}
    ${'nightly-2025-11-23'} | ${'nightly-2025-11-24'} | ${-1}
    ${'bar'}                | ${'foo'}                | ${-1}
  `('sortVersions("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(rustReleaseChannel.sortVersions(a, b)).toBe(expected);
  });

  test.each`
    version                 | expected
    ${'1.82.0'}             | ${1}
    ${'1.0.0'}              | ${1}
    ${'2.5.10'}             | ${2}
    ${'1.83.0-beta.5'}      | ${1}
    ${'nightly-2025-11-24'} | ${1}
    ${'nightly-2014-12-18'} | ${0}
    ${'stable'}             | ${1}
    ${'invalid'}            | ${null}
  `('getMajor("$version") === $expected', ({ version, expected }) => {
    expect(rustReleaseChannel.getMajor(version)).toBe(expected);
  });

  test.each`
    version                 | expected
    ${'1.82.0'}             | ${82}
    ${'1.0.0'}              | ${0}
    ${'2.5.10'}             | ${5}
    ${'1.83.0-beta.5'}      | ${83}
    ${'nightly-2025-11-24'} | ${null}
    ${'invalid'}            | ${null}
  `('getMinor("$version") === $expected', ({ version, expected }) => {
    expect(rustReleaseChannel.getMinor(version)).toBe(expected);
  });

  test.each`
    version                 | expected
    ${'1.82.0'}             | ${0}
    ${'1.0.0'}              | ${0}
    ${'2.5.10'}             | ${10}
    ${'1.83.0-beta.5'}      | ${0}
    ${'1.82'}               | ${null}
    ${'nightly-2025-11-24'} | ${null}
    ${'invalid'}            | ${null}
  `('getPatch("$version") === $expected', ({ version, expected }) => {
    expect(rustReleaseChannel.getPatch(version)).toBe(expected);
  });

  test.each`
    version                 | range                   | expected
    ${'1.82.0'}             | ${'stable'}             | ${true}
    ${'1.82.0'}             | ${'1.82'}               | ${true}
    ${'1.82.1'}             | ${'1.82'}               | ${true}
    ${'1.82.0'}             | ${'1.82.0'}             | ${true}
    ${'1.83.0-beta.5'}      | ${'beta'}               | ${true}
    ${'1.83.0-beta.5'}      | ${'1.83.0-beta'}        | ${true}
    ${'1.83.0-beta.1'}      | ${'1.83.0-beta.1'}      | ${true}
    ${'nightly-2025-11-24'} | ${'nightly'}            | ${true}
    ${'nightly-2025-11-24'} | ${'nightly-2025-11-24'} | ${true}
    ${'1.83.0-beta.5'}      | ${'stable'}             | ${false}
    ${'1.82.0'}             | ${'beta'}               | ${false}
    ${'1.82.0'}             | ${'nightly'}            | ${false}
    ${'1.83.0'}             | ${'1.82'}               | ${false}
    ${'1.82.0'}             | ${'1.83.0-beta'}        | ${false}
    ${'nightly-2025-11-24'} | ${'stable'}             | ${false}
    ${'nightly-2025-11-24'} | ${'1.82'}               | ${false}
    ${'1.82.1'}             | ${'1.82.0'}             | ${false}
    ${'invalid'}            | ${'1.82'}               | ${false}
    ${'1.82.0'}             | ${'invalid'}            | ${false}
  `(
    'matches("$version", "$range") === $expected',
    ({ version, range, expected }) => {
      expect(rustReleaseChannel.matches(version, range)).toBe(expected);
    },
  );

  test.each`
    version                                          | current                                          | expected
    ${'nightly-2025-11-24'}                          | ${'nightly-2025-11-23'}                          | ${true}
    ${'nightly-2025-11-25'}                          | ${'nightly-2025-11-24'}                          | ${true}
    ${'1.83.0'}                                      | ${'1.82.0'}                                      | ${true}
    ${'1.83.0-beta.5'}                               | ${'1.82.0'}                                      | ${true}
    ${'1.83.0'}                                      | ${'1.82.0-beta.1'}                               | ${true}
    ${'nightly-2025-11-24'}                          | ${'1.82.0'}                                      | ${false}
    ${'1.82.0'}                                      | ${'nightly-2025-11-24'}                          | ${false}
    ${'1.82.0'}                                      | ${undefined}                                     | ${true}
    ${'invalid'}                                     | ${'1.82.0'}                                      | ${false}
    ${'1.82.0'}                                      | ${'invalid'}                                     | ${false}
    ${'1.83.0-x86_64-unknown-linux-gnu'}             | ${'1.82.0-x86_64-unknown-linux-gnu'}             | ${true}
    ${'1.83.0-x86_64-unknown-linux-gnu'}             | ${'1.82.0-aarch64-apple-darwin'}                 | ${false}
    ${'1.83.0-x86_64-unknown-linux-gnu'}             | ${'1.82.0'}                                      | ${false}
    ${'1.83.0'}                                      | ${'1.82.0-x86_64-unknown-linux-gnu'}             | ${false}
    ${'nightly-2025-11-24-x86_64-unknown-linux-gnu'} | ${'nightly-2025-11-23-x86_64-unknown-linux-gnu'} | ${true}
    ${'nightly-2025-11-24-x86_64-unknown-linux-gnu'} | ${'nightly-2025-11-23-aarch64-apple-darwin'}     | ${false}
  `(
    'isCompatible("$version", "$current") === $expected',
    ({ version, current, expected }) => {
      expect(rustReleaseChannel.isCompatible(version, current)).toBe(expected);
    },
  );

  test.each`
    versions                                                  | range            | expected
    ${['1.82.0', '1.83.0', '1.84.0']}                         | ${'stable'}      | ${'1.84.0'}
    ${['1.82.0', '1.83.0-beta.1', '1.83.0-beta.5']}           | ${'beta'}        | ${'1.83.0-beta.5'}
    ${['1.82.0', '1.82.1', '1.83.0']}                         | ${'1.82'}        | ${'1.82.1'}
    ${['1.83.0-beta.1', '1.83.0-beta.5', '1.84.0-beta.10']}   | ${'1.83.0-beta'} | ${'1.83.0-beta.5'}
    ${['nightly-2025-11-22', 'nightly-2025-11-23', '1.82.0']} | ${'nightly'}     | ${'nightly-2025-11-23'}
    ${['1.82.0', '1.83.0-beta.5', 'nightly-2025-11-24']}      | ${'stable'}      | ${'1.82.0'}
    ${['1.82.0', '1.83.0']}                                   | ${'beta'}        | ${null}
    ${[]}                                                     | ${'stable'}      | ${null}
  `(
    'getSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(rustReleaseChannel.getSatisfyingVersion(versions, range)).toBe(
        expected,
      );
    },
  );

  test.each`
    versions                                                  | range            | expected
    ${['1.82.0', '1.83.0', '1.84.0']}                         | ${'stable'}      | ${'1.82.0'}
    ${['1.82.0', '1.83.0-beta.1', '1.83.0-beta.5']}           | ${'beta'}        | ${'1.83.0-beta.1'}
    ${['1.82.0', '1.82.1', '1.83.0']}                         | ${'1.82'}        | ${'1.82.0'}
    ${['1.82.0-beta.1', '1.83.0-beta.5', '1.83.0-beta.10']}   | ${'1.83.0-beta'} | ${'1.83.0-beta.5'}
    ${['nightly-2025-11-22', 'nightly-2025-11-23', '1.82.0']} | ${'nightly'}     | ${'nightly-2025-11-22'}
    ${['1.82.0', '1.83.0-beta.5', 'nightly-2025-11-24']}      | ${'stable'}      | ${'1.82.0'}
    ${['1.82.0', '1.83.0']}                                   | ${'beta'}        | ${null}
    ${[]}                                                     | ${'stable'}      | ${null}
  `(
    'minSatisfyingVersion($versions, "$range") === $expected',
    ({ versions, range, expected }) => {
      expect(rustReleaseChannel.minSatisfyingVersion(versions, range)).toBe(
        expected,
      );
    },
  );

  test.each`
    currentValue            | rangeStrategy | newVersion              | expected
    ${'stable'}             | ${'replace'}  | ${'1.83.0'}             | ${'stable'}
    ${'beta'}               | ${'replace'}  | ${'1.83.0-beta.5'}      | ${'beta'}
    ${'nightly'}            | ${'replace'}  | ${'nightly-2025-11-24'} | ${'nightly'}
    ${'nightly-2025-11-23'} | ${'replace'}  | ${'nightly-2025-11-24'} | ${'nightly-2025-11-24'}
    ${'1.82'}               | ${'replace'}  | ${'1.83.0'}             | ${'1.83'}
    ${'1.82.0'}             | ${'replace'}  | ${'1.83.0'}             | ${'1.83.0'}
    ${'1.83.0-beta'}        | ${'replace'}  | ${'1.83.0-beta.5'}      | ${'1.83.0-beta'}
    ${'1.83.0-beta.1'}      | ${'replace'}  | ${'1.83.0-beta.5'}      | ${'1.83.0-beta.5'}
    ${'1.83.0-beta'}        | ${'replace'}  | ${'1.84.0-beta.5'}      | ${'1.84.0-beta'}
    ${'1.83.0-beta'}        | ${'replace'}  | ${'1.84-beta.1'}        | ${'1.84.0-beta'}
    ${'stable'}             | ${'pin'}      | ${'1.83.0'}             | ${'1.83.0'}
    ${'beta'}               | ${'pin'}      | ${'1.83.0-beta.5'}      | ${'1.83.0-beta.5'}
    ${'nightly'}            | ${'pin'}      | ${'nightly-2025-11-24'} | ${'nightly-2025-11-24'}
    ${'1.82'}               | ${'pin'}      | ${'1.82.0'}             | ${'1.82.0'}
    ${'1.82.0'}             | ${'pin'}      | ${'1.82.0'}             | ${'1.82.0'}
    ${'invalid'}            | ${'replace'}  | ${'1.83.0'}             | ${null}
    ${'1.82.0'}             | ${'replace'}  | ${'invalid'}            | ${null}
  `(
    'getNewValue({ currentValue: "$currentValue", rangeStrategy: "$rangeStrategy", newVersion: "$newVersion" }) === $expected',
    ({ currentValue, rangeStrategy, newVersion, expected }) => {
      expect(
        rustReleaseChannel.getNewValue({
          currentValue,
          rangeStrategy,
          newVersion,
        }),
      ).toBe(expected);
    },
  );
});
