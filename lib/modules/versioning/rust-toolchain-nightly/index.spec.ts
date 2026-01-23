import { api as rustToolchainNightly } from '.';

describe('modules/versioning/rust-toolchain-nightly/index', () => {
  it.each`
    version                 | expected
    ${undefined}            | ${false}
    ${null}                 | ${false}
    ${''}                   | ${false}
    ${'nightly-2025-10-12'} | ${true}
    ${'nightly-2024-01-15'} | ${true}
    ${'nightly-2023-12-31'} | ${true}
    ${'nightly-2025-01-01'} | ${true}
    ${'nightly'}            | ${true}
    ${'nightly-2025-1-1'}   | ${false}
    ${'nightly-2025-10-1'}  | ${false}
    ${'nightly-25-10-12'}   | ${false}
    ${'stable'}             | ${false}
    ${'beta'}               | ${false}
    ${'1.89.1'}             | ${false}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(rustToolchainNightly.isValid(version)).toBe(expected);
  });

  it.each`
    version                 | expected
    ${undefined}            | ${false}
    ${null}                 | ${false}
    ${''}                   | ${false}
    ${'nightly-2025-10-12'} | ${true}
    ${'nightly-2024-01-15'} | ${true}
    ${'nightly-2023-12-31'} | ${true}
    ${'nightly-2025-01-01'} | ${true}
    ${'nightly'}            | ${false}
    ${'nightly-2025-1-1'}   | ${false}
    ${'nightly-2025-10-1'}  | ${false}
    ${'nightly-25-10-12'}   | ${false}
    ${'stable'}             | ${false}
    ${'beta'}               | ${false}
    ${'1.89.1'}             | ${false}
  `('isVersion("$version") === $expected', ({ version, expected }) => {
    expect(rustToolchainNightly.isVersion(version)).toBe(expected);
  });

  it.each`
    version                 | expected
    ${undefined}            | ${false}
    ${null}                 | ${false}
    ${''}                   | ${false}
    ${'nightly-2025-10-12'} | ${true}
    ${'nightly-2024-01-15'} | ${true}
    ${'nightly-2023-12-31'} | ${true}
    ${'nightly-2025-01-01'} | ${true}
    ${'nightly'}            | ${false}
    ${'nightly-2025-1-1'}   | ${false}
    ${'nightly-2025-10-1'}  | ${false}
    ${'nightly-25-10-12'}   | ${false}
    ${'stable'}             | ${false}
    ${'beta'}               | ${false}
    ${'1.89.1'}             | ${false}
  `('isSingleVersion("$version") === $expected', ({ version, expected }) => {
    expect(rustToolchainNightly.isSingleVersion(version)).toBe(expected);
  });

  it.each`
    version                 | expected
    ${undefined}            | ${false}
    ${null}                 | ${false}
    ${''}                   | ${false}
    ${'nightly-2025-10-12'} | ${false}
    ${'nightly-2024-01-15'} | ${false}
    ${'nightly-2023-12-31'} | ${false}
    ${'nightly-2025-01-01'} | ${false}
    ${'nightly'}            | ${false}
    ${'nightly-2025-1-1'}   | ${false}
    ${'nightly-2025-10-1'}  | ${false}
    ${'nightly-25-10-12'}   | ${false}
    ${'stable'}             | ${false}
    ${'beta'}               | ${false}
    ${'1.89.1'}             | ${false}
  `('isStable("$version") === $expected', ({ version, expected }) => {
    expect(rustToolchainNightly.isStable(version)).toBe(expected);
  });

  it.each`
    version                 | current                 | expected
    ${undefined}            | ${undefined}            | ${true}
    ${null}                 | ${null}                 | ${true}
    ${''}                   | ${''}                   | ${true}
    ${'nightly-2025-10-12'} | ${undefined}            | ${true}
    ${'nightly-2025-10-12'} | ${'nightly-2025-10-11'} | ${true}
    ${'nightly-2024-01-15'} | ${'nightly-2025-10-12'} | ${true}
    ${'nightly'}            | ${'nightly-2025-10-12'} | ${true}
    ${'nightly-2025-10-12'} | ${'1.89.0'}             | ${true}
  `(
    'isCompatible("$version", "$current") === $expected',
    ({ version, current, expected }) => {
      expect(rustToolchainNightly.isCompatible(version, current)).toBe(
        expected,
      );
    },
  );

  it.each`
    version                 | current                 | expected
    ${undefined}            | ${undefined}            | ${true}
    ${null}                 | ${null}                 | ${true}
    ${''}                   | ${''}                   | ${true}
    ${'nightly-2025-10-12'} | ${undefined}            | ${true}
    ${'nightly-2025-10-12'} | ${'nightly-2025-10-11'} | ${true}
    ${'nightly-2024-01-15'} | ${'nightly-2025-10-12'} | ${true}
    ${'nightly'}            | ${'nightly-2025-10-12'} | ${true}
    ${'nightly-2025-10-12'} | ${'1.89.0'}             | ${true}
  `(
    'isBreaking("$current", "$version") === $expected',
    ({ version, current, expected }) => {
      expect(rustToolchainNightly.isBreaking!(current, version)).toBe(expected);
    },
  );

  it.each`
    version                 | major | minor   | patch
    ${undefined}            | ${0}  | ${null} | ${null}
    ${null}                 | ${0}  | ${null} | ${null}
    ${''}                   | ${0}  | ${null} | ${null}
    ${'nightly'}            | ${0}  | ${null} | ${null}
    ${'nightly-2025-10-12'} | ${0}  | ${null} | ${null}
    ${'nightly-2024-01-15'} | ${0}  | ${null} | ${null}
    ${'nightly-2023-12-31'} | ${0}  | ${null} | ${null}
  `(
    'getMajor, getMinor, getPatch for "$version"',
    ({ version, major, minor, patch }) => {
      expect(rustToolchainNightly.getMajor(version)).toBe(major);
      expect(rustToolchainNightly.getMinor(version)).toBe(minor);
      expect(rustToolchainNightly.getPatch(version)).toBe(patch);
    },
  );

  it.each`
    a                       | b                       | expected
    ${'nightly-2025-10-12'} | ${'nightly-2025-10-12'} | ${true}
    ${'nightly-2025-10-12'} | ${'nightly-2025-10-13'} | ${false}
    ${'nightly-2024-01-15'} | ${'nightly-2024-01-15'} | ${true}
  `('equals($a, $b) === $expected', ({ a, b, expected }) => {
    expect(rustToolchainNightly.equals(a, b)).toBe(expected);
  });

  it.each`
    a                       | b                       | expected
    ${'nightly-2025-10-13'} | ${'nightly-2025-10-12'} | ${true}
    ${'nightly-2025-10-12'} | ${'nightly-2025-10-13'} | ${false}
    ${'nightly-2025-10-12'} | ${'nightly-2025-10-12'} | ${false}
    ${'nightly-2025-11-01'} | ${'nightly-2025-10-31'} | ${true}
    ${'nightly-2026-01-01'} | ${'nightly-2025-12-31'} | ${true}
    ${'nightly-2024-01-15'} | ${'nightly-2025-01-15'} | ${false}
    ${'invalid'}            | ${'nightly-2025-10-12'} | ${false}
    ${'nightly-2025-10-12'} | ${'invalid'}            | ${false}
  `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(rustToolchainNightly.isGreaterThan(a, b)).toBe(expected);
  });

  it.each`
    versions                                                              | range                   | expected
    ${['nightly-2025-10-10', 'nightly-2025-10-11', 'nightly-2025-10-12']} | ${'nightly-2025-10-12'} | ${'nightly-2025-10-12'}
    ${['nightly-2025-10-10', 'nightly-2025-10-11', 'nightly-2025-10-12']} | ${'nightly-2025-10-11'} | ${'nightly-2025-10-11'}
    ${['nightly-2025-10-10', 'nightly-2025-10-11', 'nightly-2025-10-12']} | ${'nightly-2025-10-09'} | ${null}
    ${['nightly-2025-10-10', 'nightly-2025-10-11', 'nightly-2025-10-12']} | ${'nightly-2025-10-13'} | ${null}
    ${['nightly-2025-10-10', 'nightly-2025-10-11', 'nightly-2025-10-12']} | ${'nightly'}            | ${'nightly-2025-10-12'}
    ${['nightly-2025-10-10', 'nightly-2025-10-11', 'nightly-2025-10-12']} | ${'stable'}             | ${null}
    ${[]}                                                                 | ${'nightly'}            | ${null}
    ${[]}                                                                 | ${'nightly-2025-10-12'} | ${null}
  `(
    'getSatisfyingVersion($versions, "$range") === "$expected"',
    ({ versions, range, expected }) => {
      expect(rustToolchainNightly.getSatisfyingVersion(versions, range)).toBe(
        expected,
      );
    },
  );

  it.each`
    versions                                                              | range                   | expected
    ${['nightly-2025-10-10', 'nightly-2025-10-11', 'nightly-2025-10-12']} | ${'nightly-2025-10-12'} | ${'nightly-2025-10-12'}
    ${['nightly-2025-10-10', 'nightly-2025-10-11', 'nightly-2025-10-12']} | ${'nightly-2025-10-11'} | ${'nightly-2025-10-11'}
    ${['nightly-2025-10-10', 'nightly-2025-10-11', 'nightly-2025-10-12']} | ${'nightly-2025-10-09'} | ${null}
    ${['nightly-2025-10-10', 'nightly-2025-10-11', 'nightly-2025-10-12']} | ${'nightly-2025-10-13'} | ${null}
    ${['nightly-2025-10-10', 'nightly-2025-10-11', 'nightly-2025-10-12']} | ${'nightly'}            | ${'nightly-2025-10-10'}
    ${['nightly-2025-10-10', 'nightly-2025-10-11', 'nightly-2025-10-12']} | ${'stable'}             | ${null}
    ${[]}                                                                 | ${'nightly'}            | ${null}
    ${[]}                                                                 | ${'nightly-2025-10-12'} | ${null}
  `(
    'minSatisfyingVersion($versions, "$range") === "$expected"',
    ({ versions, range, expected }) => {
      expect(rustToolchainNightly.minSatisfyingVersion(versions, range)).toBe(
        expected,
      );
    },
  );

  it.each`
    currentValue            | rangeStrategy | currentVersion          | newVersion              | expected
    ${undefined}            | ${undefined}  | ${undefined}            | ${'nightly-2025-10-12'} | ${'nightly-2025-10-12'}
    ${'nightly-2025-10-11'} | ${'replace'}  | ${'nightly-2025-10-11'} | ${'nightly-2025-10-12'} | ${'nightly-2025-10-12'}
    ${'nightly-2025-10-11'} | ${'pin'}      | ${'nightly-2025-10-11'} | ${'nightly-2025-10-12'} | ${'nightly-2025-10-12'}
  `(
    'getNewValue("$currentValue", "$rangeStrategy", "$currentVersion", "$newVersion") === "$expected"',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      expect(
        rustToolchainNightly.getNewValue({
          currentValue,
          rangeStrategy,
          currentVersion,
          newVersion,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    versions                                                              | expected
    ${['nightly-2025-10-12', 'nightly-2025-10-11', 'nightly-2025-10-13']} | ${['nightly-2025-10-11', 'nightly-2025-10-12', 'nightly-2025-10-13']}
    ${['nightly-2025-11-01', 'nightly-2025-10-31', 'nightly-2025-11-02']} | ${['nightly-2025-10-31', 'nightly-2025-11-01', 'nightly-2025-11-02']}
    ${['nightly-2026-01-01', 'nightly-2025-12-31', 'nightly-2025-12-30']} | ${['nightly-2025-12-30', 'nightly-2025-12-31', 'nightly-2026-01-01']}
    ${['nightly-2026-01-01', 'nightly-2026-01-01', 'nightly-2025-12-30']} | ${['nightly-2025-12-30', 'nightly-2026-01-01', 'nightly-2026-01-01']}
  `('$versions -> sortVersions -> $expected', ({ versions, expected }) => {
    expect(versions.sort(rustToolchainNightly.sortVersions)).toEqual(expected);
  });

  it.each`
    version                 | range                   | expected
    ${'nightly-2025-10-12'} | ${'nightly-2025-10-12'} | ${true}
    ${'nightly-2025-10-12'} | ${'nightly-2025-10-13'} | ${false}
    ${'nightly-2025-10-13'} | ${'nightly-2025-10-12'} | ${false}
    ${'nightly-2025-10-13'} | ${'nightly'}            | ${true}
    ${'nightly-2025-10-13'} | ${'stable'}             | ${false}
  `(
    'matches("$version", "$range") === "$expected"',
    ({ version, range, expected }) => {
      expect(rustToolchainNightly.matches(version, range)).toBe(expected);
    },
  );
});
