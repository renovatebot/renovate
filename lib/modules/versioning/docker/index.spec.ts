import semver from '../semver';
import docker from '.';

describe('modules/versioning/docker/index', () => {
  it.each`
    version                                        | expected
    ${null}                                        | ${false}
    ${'1.2.3'}                                     | ${true}
    ${'18.04'}                                     | ${true}
    ${'10.1'}                                      | ${true}
    ${'3'}                                         | ${true}
    ${'foo'}                                       | ${false}
    ${'0a1b2c3'}                                   | ${false}
    ${'0a1b2c3d'}                                  | ${false}
    ${'0a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d'}  | ${false}
    ${'0a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0'} | ${true}
    ${'0a1b2C3'}                                   | ${true}
    ${'0z1b2c3'}                                   | ${true}
    ${'0A1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d'}  | ${true}
    ${'123098140293'}                              | ${true}
    ${'01aecc#v2.1.0'}                             | ${false}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    const res = docker.isValid(version);
    expect(!!res).toBe(expected);
  });

  it.each`
    version    | major   | minor   | patch
    ${'1.2.3'} | ${1}    | ${2}    | ${3}
    ${'18.04'} | ${18}   | ${4}    | ${null}
    ${'10.1'}  | ${10}   | ${1}    | ${null}
    ${'3'}     | ${3}    | ${null} | ${null}
    ${'foo'}   | ${null} | ${null} | ${null}
  `(
    'getMajor, getMinor, getPatch for "$version"',
    ({ version, major, minor, patch }) => {
      expect(docker.getMajor(version)).toBe(major);
      expect(docker.getMinor(version)).toBe(minor);
      expect(docker.getPatch(version)).toBe(patch);
    },
  );

  it.each`
    a          | b           | expected
    ${'1.2.3'} | ${'1.2'}    | ${false}
    ${'18.04'} | ${'18.1'}   | ${true}
    ${'10.1'}  | ${'10.1.2'} | ${true}
    ${'3'}     | ${'2'}      | ${true}
    ${'1.2.3'} | ${'1.2.3'}  | ${false}
  `('isGreaterThan($a, $b) === $expected', ({ a, b, expected }) => {
    expect(docker.isGreaterThan(a, b)).toBe(expected);
  });

  it.each`
    version    | range       | expected
    ${'1.2.3'} | ${'2.0'}    | ${true}
    ${'18.04'} | ${'18.1'}   | ${false}
    ${'10.1'}  | ${'10.0.4'} | ${false}
    ${'3'}     | ${'4.0'}    | ${true}
    ${'1.2'}   | ${'1.3.4'}  | ${true}
  `(
    'isLessThanRange($version, $range) === $expected',
    ({ version, range, expected }) => {
      expect(docker.isLessThanRange?.(version, range)).toBe(expected);
    },
  );

  it.each`
    a          | b           | expected
    ${'1.2.3'} | ${'1.2.3'}  | ${true}
    ${'18.04'} | ${'18.4'}   | ${true}
    ${'10.0'}  | ${'10.0.4'} | ${false}
    ${'3'}     | ${'4.0'}    | ${false}
    ${'1.2'}   | ${'1.2.3'}  | ${false}
  `('equals($a, $b) === $expected', ({ a, b, expected }) => {
    expect(docker.equals(a, b)).toBe(expected);
  });

  describe('Satisfying versions', () => {
    const versions = [
      '0.9.8',
      '1.1.1',
      '1.1',
      '1.2.3',
      '1.2',
      '1',
      '2.2.2',
      '2.2',
      '2',
    ];

    it.each`
      version    | expected
      ${'1.2.3'} | ${'1.2.3'}
      ${'1.2'}   | ${'1.2'}
      ${'1'}     | ${'1'}
      ${'1.3'}   | ${null}
      ${'0.9'}   | ${null}
    `(`satisfying for $version -> $expected`, ({ version, expected }) => {
      const satisfying = docker.getSatisfyingVersion(versions, version);
      const minSatisfying = docker.minSatisfyingVersion(versions, version);
      expect(satisfying).toBe(expected);
      expect(minSatisfying).toBe(expected);
    });
  });

  describe('sortVersions(v1, v2)', () => {
    it.each`
      a          | b
      ${'1.1.1'} | ${'1.2.3'}
      ${'1.2.3'} | ${'1.3.4'}
      ${'2.0.1'} | ${'1.2.3'}
      ${'1.2.3'} | ${'0.9.5'}
    `(
      'docker.sortVersions("$a", "$b") === semver.sortVersions("$a", "$b")',
      ({ a, b }) => {
        const dockerSorted = docker.sortVersions(a, b);
        const semverSorted = semver.sortVersions(a, b);
        expect(dockerSorted).toBe(semverSorted);
      },
    );

    it('sorts unstable', () => {
      const versions = [
        '3.7.0',
        '3.7-alpine',
        '3.7.0b1',
        '3.7.0b5',
        '3.8.0b1-alpine',
        '3.8.0-alpine',
        '3.8.2',
        '3.8.0',
      ];

      expect(versions.sort((x, y) => docker.sortVersions(x, y))).toEqual([
        '3.7.0b1',
        '3.7.0b5',
        '3.7.0',
        '3.7-alpine',
        '3.8.0b1-alpine',
        '3.8.0-alpine',
        '3.8.0',
        '3.8.2',
      ]);
    });
  });

  it.each`
    currentValue | rangeStrategy | currentVersion | newVersion | expected
    ${null}      | ${null}       | ${null}        | ${'1.2.3'} | ${'1.2.3'}
  `(
    'getNewValue($currentValue, $rangeStrategy, $currentVersion, $newVersion, $expected) === $expected',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      const res = docker.getNewValue({
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
      });
      expect(res).toBe(expected);
    },
  );

  it.each`
    version             | expected
    ${'3.7.0'}          | ${true}
    ${'3.7.0b1'}        | ${false}
    ${'3.7-alpine'}     | ${true}
    ${'3.8.0-alpine'}   | ${true}
    ${'3.8.0b1-alpine'} | ${false}
    ${'3.8.2'}          | ${true}
  `('isStable("$version") === $expected', ({ version, expected }) => {
    const res = docker.isStable(version);
    expect(!!res).toBe(expected);
  });

  it.each`
    version             | range             | expected
    ${'3.7.0'}          | ${'3.7.0'}        | ${true}
    ${'3.7.0b1'}        | ${'3.7.0'}        | ${true}
    ${'3.7-alpine'}     | ${'3.7.0'}        | ${false}
    ${'3.8.0-alpine'}   | ${'3.7.0'}        | ${false}
    ${'3.8.0b1-alpine'} | ${'3.7.0'}        | ${false}
    ${'3.8.2'}          | ${'3.7.0'}        | ${true}
    ${'3.7.0'}          | ${'3.7.0-alpine'} | ${false}
    ${'3.7.0b1'}        | ${'3.7.0-alpine'} | ${false}
    ${'3.7-alpine'}     | ${'3.7.0-alpine'} | ${false}
    ${'3.8.0-alpine'}   | ${'3.7.0-alpine'} | ${true}
    ${'3.8.0b1-alpine'} | ${'3.7.0-alpine'} | ${true}
    ${'3.8.2'}          | ${'3.7.0-alpine'} | ${false}
  `(
    'isCompatible("$version") === $expected',
    ({ version, range, expected }) => {
      const res = docker.isCompatible(version, range);
      expect(!!res).toBe(expected);
    },
  );

  it.each`
    value               | expected
    ${'3.7.0'}          | ${'3.7.0'}
    ${'3.7.0b1'}        | ${'3.7.0b1'}
    ${'3.7-alpine'}     | ${'3.7'}
    ${'3.8.0-alpine'}   | ${'3.8.0'}
    ${'3.8.0b1-alpine'} | ${'3.8.0b1'}
    ${'3.8.2'}          | ${'3.8.2'}
    ${undefined}        | ${undefined}
  `('valueToVersion("$value") === $expected', ({ value, expected }) => {
    const res = docker.valueToVersion?.(value);
    expect(res).toBe(expected);
  });
});
