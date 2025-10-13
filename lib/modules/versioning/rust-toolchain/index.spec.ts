import rustToolchain from '.';

describe('modules/versioning/rust-toolchain/index', () => {
  it.each`
    version                 | expected
    ${''}                   | ${false}
    ${'1.90.0'}             | ${true}
    ${'1.0.0'}              | ${true}
    ${'0.0.0'}              | ${true}
    ${'1.90'}               | ${true}
    ${'0.1'}                | ${true}
    ${'stable'}             | ${false}
    ${'beta'}               | ${false}
    ${'nightly'}            | ${false}
    ${'nightly-2025-10-12'} | ${false}
  `('isValid($version) === $expected', ({ version, expected }) => {
    expect(rustToolchain.isValid(version)).toBe(expected);
  });

  it.each`
    version                 | expected
    ${undefined}            | ${false}
    ${null}                 | ${false}
    ${''}                   | ${false}
    ${'1.90.0'}             | ${true}
    ${'1.0.0'}              | ${true}
    ${'0.0.0'}              | ${true}
    ${'1.90'}               | ${false}
    ${'0.1'}                | ${false}
    ${'stable'}             | ${false}
    ${'beta'}               | ${false}
    ${'nightly'}            | ${false}
    ${'nightly-2025-10-12'} | ${false}
  `('isVersion($version) === $expected', ({ version, expected }) => {
    expect(rustToolchain.isVersion(version)).toBe(expected);
  });

  it.each`
    version                 | expected
    ${''}                   | ${false}
    ${'1.90.0'}             | ${true}
    ${'1.0.0'}              | ${true}
    ${'0.0.0'}              | ${true}
    ${'1.90'}               | ${false}
    ${'0.1'}                | ${false}
    ${'stable'}             | ${false}
    ${'beta'}               | ${false}
    ${'nightly'}            | ${false}
    ${'nightly-2025-10-12'} | ${false}
  `('isSingleVersion($version) === $expected', ({ version, expected }) => {
    expect(rustToolchain.isSingleVersion(version)).toBe(expected);
  });

  it.each`
    version                 | expected
    ${''}                   | ${false}
    ${'1.90.0'}             | ${true}
    ${'1.0.0'}              | ${true}
    ${'0.99.9999'}          | ${false}
    ${'0.0.0'}              | ${false}
    ${'1.90'}               | ${true}
    ${'0.1'}                | ${false}
    ${'stable'}             | ${false}
    ${'beta'}               | ${false}
    ${'nightly'}            | ${false}
    ${'nightly-2025-10-12'} | ${false}
  `('isStable($version) === $expected', ({ version, expected }) => {
    expect(rustToolchain.isStable(version)).toBe(expected);
  });

  it.each`
    version                 | expected
    ${''}                   | ${false}
    ${'1.90.0'}             | ${true}
    ${'1.0.0'}              | ${true}
    ${'0.99.9999'}          | ${true}
    ${'0.0.0'}              | ${true}
    ${'1.90'}               | ${true}
    ${'0.1'}                | ${true}
    ${'stable'}             | ${false}
    ${'beta'}               | ${false}
    ${'nightly'}            | ${false}
    ${'nightly-2025-10-12'} | ${false}
  `('isCompatible($version) === $expected', ({ version, expected }) => {
    expect(rustToolchain.isCompatible(version)).toBe(expected);
  });

  it.each`
    version                 | major   | minor   | patch
    ${''}                   | ${null} | ${null} | ${null}
    ${'1.90.0'}             | ${1}    | ${90}   | ${0}
    ${'1.0.0'}              | ${1}    | ${0}    | ${0}
    ${'0.99.9999'}          | ${0}    | ${99}   | ${9999}
    ${'0.0.0'}              | ${0}    | ${0}    | ${0}
    ${'1.90'}               | ${1}    | ${90}   | ${null}
    ${'0.1'}                | ${0}    | ${1}    | ${null}
    ${'stable'}             | ${null} | ${null} | ${null}
    ${'beta'}               | ${null} | ${null} | ${null}
    ${'nightly'}            | ${null} | ${null} | ${null}
    ${'nightly-2025-10-12'} | ${null} | ${null} | ${null}
  `(
    'getMajor($version) === $major && getMinor($version) === $minor && getPatch($version) === $patch',
    ({ version, major, minor, patch }) => {
      expect(rustToolchain.getMajor(version)).toBe(major);
      expect(rustToolchain.getMinor(version)).toBe(minor);
      expect(rustToolchain.getPatch(version)).toBe(patch);
    },
  );

  it.each`
    version                 | other       | expected
    ${'1.90.0'}             | ${'1.90.0'} | ${true}
    ${'1.90.0'}             | ${'1.89.0'} | ${false}
    ${'1.90.0'}             | ${'1.90'}   | ${false}
    ${'1.90'}               | ${'1.90.0'} | ${false}
    ${'1.90'}               | ${'1.89'}   | ${false}
    ${'1.90'}               | ${'1.90'}   | ${true}
    ${'stable'}             | ${'1.90.0'} | ${false}
    ${'stable'}             | ${'1.90'}   | ${false}
    ${'beta'}               | ${'1.90.0'} | ${false}
    ${'nightly'}            | ${'1.90.0'} | ${false}
    ${'nightly-2025-10-12'} | ${'1.90.0'} | ${false}
  `(
    'equals($version, $other) === $expected',
    ({ version, other, expected }) => {
      expect(rustToolchain.equals(version, other)).toBe(expected);
    },
  );

  it.each`
    version     | other       | expected
    ${'1.90.0'} | ${'0.0.0'}  | ${true}
    ${'1.90.0'} | ${'2.0.0'}  | ${false}
    ${'1.90.0'} | ${'1.89.0'} | ${true}
    ${'1.90.0'} | ${'1.91.0'} | ${false}
    ${'1.90.1'} | ${'1.90.0'} | ${true}
    ${'1.90.0'} | ${'1.90.1'} | ${false}
  `(
    'isGreaterThan($version, $other) === $expected',
    ({ version, other, expected }) => {
      expect(rustToolchain.isGreaterThan(version, other)).toBe(expected);
    },
  );

  it.each`
    versions                          | range       | expected
    ${['1.89.0', '1.89.1', '1.90.0']} | ${'1.89.1'} | ${'1.89.1'}
    ${['1.89.0', '1.89.1', '1.90.0']} | ${'1.88.0'} | ${null}
    ${['1.89.0', '1.89.1', '1.90.0']} | ${'1.91.0'} | ${null}
    ${['1.89.0', '1.89.1', '1.90.0']} | ${'stable'} | ${null}
    ${['1.89.0', '1.89.1', '1.90.0']} | ${'1.89'}   | ${'1.89.1'}
    ${[]}                             | ${'1.89.1'} | ${null}
    ${[]}                             | ${'1.89'}   | ${null}
    ${[]}                             | ${'stable'} | ${null}
  `(
    'getSatisfyingVersion($versions, $range) === $expected',
    ({ versions, range, expected }) => {
      expect(rustToolchain.getSatisfyingVersion(versions, range)).toBe(
        expected,
      );
    },
  );

  it.each`
    versions                          | range       | expected
    ${['1.89.0', '1.89.1', '1.90.0']} | ${'1.89.1'} | ${'1.89.1'}
    ${['1.89.0', '1.89.1', '1.90.0']} | ${'1.88.0'} | ${null}
    ${['1.89.0', '1.89.1', '1.90.0']} | ${'1.91.0'} | ${null}
    ${['1.89.0', '1.89.1', '1.90.0']} | ${'stable'} | ${null}
    ${['1.89.0', '1.89.1', '1.90.0']} | ${'1.89'}   | ${'1.89.0'}
    ${[]}                             | ${'1.89.1'} | ${null}
    ${[]}                             | ${'1.89'}   | ${null}
    ${[]}                             | ${'stable'} | ${null}
  `(
    'minSatisfyingVersion($versions, $range) === $expected',
    ({ versions, range, expected }) => {
      expect(rustToolchain.minSatisfyingVersion(versions, range)).toBe(
        expected,
      );
    },
  );

  it.each`
    input                                                                                 | expected
    ${{ rangeStrategy: 'replace', currentValue: '1.90.0', newVersion: '2.0.0' }}          | ${'2.0.0'}
    ${{ rangeStrategy: 'replace', currentValue: '1.90.0', newVersion: '1.91.0' }}         | ${'1.91.0'}
    ${{ rangeStrategy: 'replace', currentValue: '1.90.0', newVersion: '1.90.1' }}         | ${'1.90.1'}
    ${{ rangeStrategy: 'replace', currentValue: '1.90.0', newVersion: '1.90.0' }}         | ${null}
    ${{ rangeStrategy: 'replace', currentValue: '1.90', newVersion: '2.0.0' }}            | ${'2.0'}
    ${{ rangeStrategy: 'replace', currentValue: '1.90', newVersion: '1.91.0' }}           | ${'1.91'}
    ${{ rangeStrategy: 'replace', currentValue: '1.90', newVersion: '1.90.1' }}           | ${null}
    ${{ rangeStrategy: 'replace', currentValue: 'stable', newVersion: '1.91.0' }}         | ${null}
    ${{ rangeStrategy: 'replace', currentValue: 'beta', newVersion: '1.91.0' }}           | ${null}
    ${{ rangeStrategy: 'pin', currentValue: '1.90.0', newVersion: '1.91.0' }}             | ${'1.91.0'}
    ${{ rangeStrategy: 'pin', currentValue: '1.90.0', newVersion: '1.90.1' }}             | ${'1.90.1'}
    ${{ rangeStrategy: 'pin', currentValue: '1.90.0', newVersion: '1.90.0' }}             | ${null}
    ${{ rangeStrategy: 'pin', currentValue: '1.90', newVersion: '1.91.0' }}               | ${'1.91.0'}
    ${{ rangeStrategy: 'pin', currentValue: '1.90', newVersion: '1.90.1' }}               | ${'1.90.1'}
    ${{ rangeStrategy: 'pin', currentValue: 'stable', newVersion: '1.91.0' }}             | ${null}
    ${{ rangeStrategy: 'pin', currentValue: 'beta', newVersion: '1.91.0' }}               | ${null}
    ${{ rangeStrategy: 'update-lockfile', currentValue: '1.90.0', newVersion: '1.91.0' }} | ${null}
  `(
    'getNewValue($input.rangeStrategy: $input.currentValue -> $input.newVersion) === $expected',
    ({ input, expected }) => {
      expect(rustToolchain.getNewValue(input)).toBe(expected);
    },
  );

  it.each`
    version     | other       | expected
    ${'1.90.0'} | ${''}       | ${1}
    ${''}       | ${'1.90.0'} | ${-1}
    ${''}       | ${''}       | ${0}
    ${'1.90.0'} | ${'1.90.0'} | ${0}
    ${'1.90.0'} | ${'0.0.0'}  | ${1}
    ${'1.90.0'} | ${'2.0.0'}  | ${-1}
    ${'1.90.0'} | ${'1.89.0'} | ${1}
    ${'1.90.0'} | ${'1.91.0'} | ${-1}
    ${'1.90.1'} | ${'1.90.0'} | ${1}
    ${'1.90.0'} | ${'1.90.1'} | ${-1}
  `(
    'sortVersions($version, $other) === $expected',
    ({ version, other, expected }) => {
      expect(rustToolchain.sortVersions(version, other)).toBe(expected);
    },
  );

  it.each`
    version     | range                   | expected
    ${'1.90.0'} | ${'1.90.0'}             | ${true}
    ${'1.90.0'} | ${'1.89.0'}             | ${false}
    ${'1.90.0'} | ${'1.91'}               | ${false}
    ${'1.90.0'} | ${'1.90'}               | ${true}
    ${'1.90.0'} | ${'1.89'}               | ${false}
    ${'1.90.0'} | ${'stable'}             | ${false}
    ${'1.90.0'} | ${'beta'}               | ${false}
    ${'1.90.0'} | ${'nightly'}            | ${false}
    ${'1.90.0'} | ${'nightly-2025-10-12'} | ${false}
  `(
    'matches($version, $range) === $expected',
    ({ version, range, expected }) => {
      expect(rustToolchain.matches(version, range)).toBe(expected);
    },
  );
});
