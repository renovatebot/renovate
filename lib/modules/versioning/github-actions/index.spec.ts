import { logger } from '~test/util.ts';
import githubActions from './index.ts';

describe('modules/versioning/github-actions/index', () => {
  describe('.isValid()', () => {
    it.each`
      version           | expected
      ${'1'}            | ${true}
      ${'1.2'}          | ${true}
      ${'1.2.3'}        | ${true}
      ${'~latest'}      | ${false}
      ${'1.2.3-alpha'}  | ${true}
      ${'v1'}           | ${true}
      ${'v1.2'}         | ${true}
      ${'v1.2.3'}       | ${true}
      ${'v1.2.3-alpha'} | ${true}
      ${'invalid'}      | ${false}
      ${''}             | ${false}
      ${'<6'}           | ${false}
      ${'>=5'}          | ${false}
      ${'~4'}           | ${false}
      ${'^3'}           | ${false}
    `('isValid("$version") === $expected', ({ version, expected }) => {
      expect(githubActions.isValid(version)).toBe(expected);
    });
  });

  describe('.isVersion()', () => {
    it.each`
      version           | expected
      ${'1'}            | ${true}
      ${'1.2'}          | ${true}
      ${'1.2.3'}        | ${true}
      ${'~latest'}      | ${false}
      ${'1.2.3-alpha'}  | ${true}
      ${'1.2.3-rc.1'}   | ${true}
      ${'v1'}           | ${true}
      ${'v1.2'}         | ${true}
      ${'v1.2.3'}       | ${true}
      ${'v1.2.3-alpha'} | ${true}
      ${'v1.2.3-rc.1'}  | ${true}
      ${'invalid'}      | ${false}
      ${''}             | ${false}
      ${'#1.0.0'}       | ${false}
      ${'x1.0.0'}       | ${false}
    `('isVersion("$version") === $expected', ({ version, expected }) => {
      expect(githubActions.isVersion(version)).toBe(expected);
    });
  });

  describe('.isStable()', () => {
    it.each`
      version             | expected
      ${'1.0.0-alpha'}    | ${false}
      ${'1.0.0-beta'}     | ${false}
      ${'1.0.0-rc'}       | ${false}
      ${'1.0.0-pre'}      | ${false}
      ${'1.0.0-dev'}      | ${false}
      ${'1.0.0-snapshot'} | ${false}
      ${'1.0.0-unstable'} | ${false}
      ${'1.0.0-Alpha'}    | ${false}
      ${'1.0.0-1'}        | ${false}
      ${'1.0.0-build.1'}  | ${false}
      ${'1.0.0'}          | ${true}
      ${'v1.0.0'}         | ${true}
      ${'v1.0.0-alpha'}   | ${false}
      ${'1.2'}            | ${true}
      ${'v1.2'}           | ${true}
      ${'1'}              | ${true}
      ${'v1'}             | ${true}
      ${'not-a-version'}  | ${false}
    `('isStable("$version") === $expected', ({ version, expected }) => {
      expect(githubActions.isStable(version)).toBe(expected);
    });
  });

  describe('.isSingleVersion()', () => {
    it.each`
      version           | expected
      ${'1'}            | ${false}
      ${'1.2'}          | ${false}
      ${'1.2.3'}        | ${true}
      ${'~latest'}      | ${false}
      ${'1.2.3-alpha'}  | ${true}
      ${'v1'}           | ${false}
      ${'v1.2'}         | ${false}
      ${'v1.2.3'}       | ${true}
      ${'v1.2.3-alpha'} | ${true}
    `('isSingleVersion("$version") === $expected', ({ version, expected }) => {
      expect(githubActions.isSingleVersion(version)).toBe(expected);
    });
  });

  describe('.matches()', () => {
    it.each`
      version             | range        | expected
      ${'1.1.0'}          | ${'1.0'}     | ${false}
      ${'1.0.0'}          | ${'1'}       | ${true}
      ${'1.2.0'}          | ${'1'}       | ${true}
      ${'1.2.3'}          | ${'1'}       | ${true}
      ${'2.0.0'}          | ${'1'}       | ${false}
      ${'1.1.0'}          | ${'1.1'}     | ${true}
      ${'1.1.5'}          | ${'1.1'}     | ${true}
      ${'1.2.0'}          | ${'1.1'}     | ${false}
      ${'1.0.0'}          | ${'1.1'}     | ${false}
      ${'1.2.3'}          | ${'1.2'}     | ${true}
      ${'1.2.0'}          | ${'1.2'}     | ${true}
      ${'1.3.0'}          | ${'1.2'}     | ${false}
      ${'1.0.0'}          | ${'~latest'} | ${false}
      ${'2.1.0'}          | ${'~latest'} | ${false}
      ${'1.0.0-rc'}       | ${'1'}       | ${false}
      ${'1.0.0-rc'}       | ${'1.0'}     | ${false}
      ${'invalid'}        | ${'1'}       | ${false}
      ${'~latest'}        | ${'1'}       | ${false}
      ${'1'}              | ${'1'}       | ${true}
      ${'1'}              | ${'v1'}      | ${true}
      ${'v1'}             | ${'v1'}      | ${true}
      ${'v1'}             | ${'1'}       | ${true}
      ${'1.2'}            | ${'1.2'}     | ${true}
      ${'1.2'}            | ${'v1.2'}    | ${true}
      ${'v1.2'}           | ${'v1.2'}    | ${true}
      ${'v1.2'}           | ${'1.2'}     | ${true}
      ${'1.2.4'}          | ${'1.2.3'}   | ${false}
      ${'not-semver-ver'} | ${'1'}       | ${false}
      ${'1.0.0-alpha'}    | ${'1'}       | ${false}
      ${'1.0.0-beta'}     | ${'1.0'}     | ${false}
      ${'v1.0.0'}         | ${'v1'}      | ${true}
      ${'v1.2.0'}         | ${'v1'}      | ${true}
      ${'v1.1.0'}         | ${'v1.1'}    | ${true}
      ${'v1.2.3'}         | ${'v1.2.3'}  | ${true}
      ${'v2.0.0'}         | ${'v1'}      | ${false}
      ${'v1.0.0'}         | ${'1'}       | ${true}
      ${'1.0.0'}          | ${'v1'}      | ${true}
      ${'v1.1.5'}         | ${'1.1'}     | ${true}
      ${'1.1.5'}          | ${'v1.1'}    | ${true}
      ${'v2.1.0'}         | ${'2'}       | ${true}
      ${'2.1.0'}          | ${'v2'}      | ${true}
      ${'v1.2.0'}         | ${'1.1'}     | ${false}
      ${'1.2.0'}          | ${'v1.1'}    | ${false}
      ${'v1.0.0-rc'}      | ${'v1'}      | ${false}
      ${'1.0.0-rc'}       | ${'v1'}      | ${false}
      ${'v1.0.0-rc'}      | ${'1'}       | ${false}
      ${'v1.2.4'}         | ${'1.2.3'}   | ${false}
      ${'1.2.4'}          | ${'v1.2.3'}  | ${false}
      ${'v1.2.3'}         | ${'1.2.3'}   | ${true}
      ${'1.2.3'}          | ${'v1.2.3'}  | ${true}
    `(
      'matches("$version", "$range") === $expected',
      ({ version, range, expected }) => {
        expect(githubActions.matches(version, range)).toBe(expected);
      },
    );

    it('should not handle invalid range that is not ~latest or valid version', () => {
      expect(githubActions.matches('1.0.0', 'completely-invalid-range')).toBe(
        false,
      );
    });
  });

  describe('.getSatisfyingVersion()', () => {
    it.each`
      versions                                                     | range        | expected
      ${['1.0.0', '1.1.0', '1.1.1', '1.2.0', '2.0.0', '2.0.1']}    | ${'1'}       | ${'1.2.0'}
      ${['1.0.0', '1.1.0', '1.1.1', '1.2.0', '2.0.0', '2.0.1']}    | ${'1.1'}     | ${'1.1.1'}
      ${['1.0.0', '1.1.0', '1.1.1', '1.2.0', '2.0.0', '2.0.1']}    | ${'2'}       | ${'2.0.1'}
      ${['1.0.0', '1.1.0', '1.1.1', '1.2.0', '2.0.0', '2.1.0']}    | ${'~latest'} | ${null}
      ${['1.0.0', '1.1.0', '1.2.0', '2.0.0', '2.0.1', '2.1.0-rc']} | ${'2'}       | ${'2.0.1'}
      ${['1.0.0', '1.0.1-rc', '1.1.0']}                            | ${'1.0'}     | ${'1.0.0'}
      ${['0.5.0', '1.0.0', '2.0.0']}                               | ${'3'}       | ${null}
      ${['invalid-version', '1.0.0']}                              | ${'1'}       | ${'1.0.0'}
      ${['1.0', '1.1', '1.2']}                                     | ${'1'}       | ${null}
      ${['0.9.0-alpha', '0.9.0-beta', '0.9.0']}                    | ${'~latest'} | ${null}
      ${['some-text', 'another-text']}                             | ${'1'}       | ${null}
      ${['not-valid', 'also-bad']}                                 | ${'1'}       | ${null}
      ${['1.0.0', '1.0.1-alpha', '1.0.2', '1.1.0-beta', '1.1.1']}  | ${'1'}       | ${'1.1.1'}
      ${['1.0.0', '1.0.1-alpha', '1.0.2', '1.1.0-beta', '1.1.1']}  | ${'1.0'}     | ${'1.0.2'}
      ${['v1.0.0', 'v1.1.0', 'v1.1.1', 'v1.2.0', 'v2.0.0']}        | ${'v1'}      | ${'v1.2.0'}
      ${['v1.0.0', 'v1.1.0', 'v1.1.1']}                            | ${'v1.1'}    | ${'v1.1.1'}
      ${['v1.0.0', 'v2.0.0', 'v3.0.0']}                            | ${'v2'}      | ${'v2.0.0'}
      ${['1.0.0', 'v1.1.0', '1.1.1', 'v1.2.0', '2.0.0']}           | ${'1'}       | ${'v1.2.0'}
      ${['v1.0.0', '1.1.0', 'v1.1.1']}                             | ${'v1.1'}    | ${'v1.1.1'}
      ${['1.0.0', 'v1.1.0', '1.1.1']}                              | ${'1'}       | ${'1.1.1'}
      ${['v1.0.0', '1.1.0', 'v1.1.1']}                             | ${'1'}       | ${'v1.1.1'}
      ${['1.0.0', '1.1.0', '1.2.0']}                               | ${'v1'}      | ${'1.2.0'}
      ${['v1.0.0', 'v1.1.0', '1.2.0']}                             | ${'1'}       | ${'1.2.0'}
    `(
      'getSatisfyingVersion($versions, "$range") === $expected',
      ({ versions, range, expected }) => {
        expect(githubActions.getSatisfyingVersion(versions, range)).toBe(
          expected,
        );
      },
    );
  });

  describe('.minSatisfyingVersion()', () => {
    it.each`
      versions                                                  | range        | expected
      ${['1.0.0', '1.1.0', '1.1.1', '1.2.0', '2.0.0']}          | ${'1'}       | ${'1.0.0'}
      ${['1.0.0', '1.1.0', '1.1.1', '1.2.0', '2.0.0']}          | ${'1.1'}     | ${'1.1.0'}
      ${['1.0.0', '1.1.0', '1.1.1', '1.2.0', '2.0.0', '2.0.1']} | ${'2'}       | ${'2.0.0'}
      ${['1.0.0', '1.1.0', '1.2.0', '2.0.0', '2.0.1', '2.1.0']} | ${'~latest'} | ${null}
      ${['1.0.0', '1.0.1-rc', '1.1.0']}                         | ${'1.0'}     | ${'1.0.0'}
      ${['0.5.0', '1.0.0', '2.0.0']}                            | ${'3'}       | ${null}
      ${['v0.5.0', 'v1.0.0', 'v2.0.0']}                         | ${'v3'}      | ${null}
      ${['v1.0.0', '1.1.0', 'v1.2.0']}                          | ${'1'}       | ${'v1.0.0'}
      ${['1.0.0', 'v1.1.0', '1.2.0']}                           | ${'v1'}      | ${'1.0.0'}
      ${['v1.0.0', 'v1.1.0', '1.2.0', 'v2.0.0']}                | ${'v1'}      | ${'v1.0.0'}
      ${['1.0.0', '1.1.0', 'v1.2.0', '2.0.0']}                  | ${'1'}       | ${'1.0.0'}
    `(
      'minSatisfyingVersion($versions, "$range") === $expected',
      ({ versions, range, expected }) => {
        expect(githubActions.minSatisfyingVersion(versions, range)).toBe(
          expected,
        );
      },
    );
  });

  describe('.isLessThanRange()', () => {
    it.each`
      version      | range        | expected
      ${'0.9.0'}   | ${'1'}       | ${true}
      ${'1.0.0'}   | ${'1'}       | ${false}
      ${'1.5.0'}   | ${'1'}       | ${false}
      ${'2.0.0'}   | ${'1'}       | ${false}
      ${'1.0.0'}   | ${'1.1'}     | ${true}
      ${'1.1.0'}   | ${'1.1'}     | ${false}
      ${'1.2.0'}   | ${'1.1'}     | ${false}
      ${'0.9.0'}   | ${'~latest'} | ${false}
      ${'1.0.0'}   | ${'~latest'} | ${false}
      ${'1.5.0'}   | ${'1'}       | ${false}
      ${'invalid'} | ${'1'}       | ${false}
      ${'v0.9.0'}  | ${'v1'}      | ${true}
      ${'v1.0.0'}  | ${'v1'}      | ${false}
      ${'v1.0.0'}  | ${'v1.1'}    | ${true}
      ${'0.9.0'}   | ${'v1'}      | ${true}
      ${'v0.9.0'}  | ${'1'}       | ${true}
      ${'1.0.0'}   | ${'v1.1'}    | ${true}
      ${'v1.0.0'}  | ${'1.1'}     | ${true}
      ${'v2.0.0'}  | ${'1'}       | ${false}
      ${'2.0.0'}   | ${'v1'}      | ${false}
      ${'v1.2'}    | ${'v1.3'}    | ${true}
      ${'v1.3'}    | ${'v1.2'}    | ${false}
      ${'v1.2'}    | ${'v1.2'}    | ${false}
    `(
      'isLessThanRange("$version", "$range") === $expected',
      ({ version, range, expected }) => {
        expect(githubActions.isLessThanRange?.(version, range)).toBe(expected);
      },
    );
  });

  describe('.equals()', () => {
    it.each`
      version      | other        | expected
      ${'1.0.0'}   | ${'1.0.0'}   | ${true}
      ${'1.0.0'}   | ${'1.0.1'}   | ${false}
      ${'invalid'} | ${'1.0.0'}   | ${false}
      ${'1.0.0'}   | ${'invalid'} | ${false}
      ${'invalid'} | ${'invalid'} | ${false}
      ${'v1.0.0'}  | ${'v1.0.0'}  | ${true}
      ${'v1.0.0'}  | ${'v1.0.1'}  | ${false}
      ${'v1.0.0'}  | ${'1.0.0'}   | ${true}
      ${'1.0.0'}   | ${'v1.0.0'}  | ${true}
      ${'v1.0.0'}  | ${'1.0.1'}   | ${false}
      ${'1.0.1'}   | ${'v1.0.0'}  | ${false}
      ${'v1.2'}    | ${'v1.2'}    | ${true}
      ${'v1.2'}    | ${'v1.3'}    | ${false}
      ${'v1.2'}    | ${'1.2'}     | ${true}
      ${'v1'}      | ${'v1'}      | ${true}
      ${'v6'}      | ${'v5'}      | ${false}
    `(
      'equals("$version", "$other") === $expected',
      ({ version, other, expected }) => {
        expect(githubActions.equals(version, other)).toBe(expected);
      },
    );
  });

  describe('.getMajor()', () => {
    it.each`
      version      | expected
      ${'1.0.0'}   | ${1}
      ${'2.3.4'}   | ${2}
      ${'v1.0.0'}  | ${1}
      ${'v2.3.4'}  | ${2}
      ${'v1.2'}    | ${1}
      ${'v1'}      | ${1}
      ${'invalid'} | ${null}
    `('getMajor("$version") === $expected', ({ version, expected }) => {
      expect(githubActions.getMajor(version)).toBe(expected);
    });
  });

  describe('.getMinor()', () => {
    it.each`
      version      | expected
      ${'1.0.0'}   | ${0}
      ${'2.3.4'}   | ${3}
      ${'v1.0.0'}  | ${0}
      ${'v2.3.4'}  | ${3}
      ${'v1.2'}    | ${2}
      ${'invalid'} | ${null}
    `('getMinor("$version") === $expected', ({ version, expected }) => {
      expect(githubActions.getMinor(version)).toBe(expected);
    });
  });

  describe('.getPatch()', () => {
    it.each`
      version      | expected
      ${'1.0.0'}   | ${0}
      ${'2.3.4'}   | ${4}
      ${'v1.0.0'}  | ${0}
      ${'v2.3.4'}  | ${4}
      ${'v1.2'}    | ${0}
      ${'invalid'} | ${null}
    `('getPatch("$version") === $expected', ({ version, expected }) => {
      expect(githubActions.getPatch(version)).toBe(expected);
    });
  });

  describe('.isGreaterThan()', () => {
    it.each`
      version      | other        | expected
      ${'1.0.1'}   | ${'1.0.0'}   | ${true}
      ${'1.0.0'}   | ${'1.0.1'}   | ${false}
      ${'2.0.0'}   | ${'1.9.9'}   | ${true}
      ${'invalid'} | ${'1.0.0'}   | ${false}
      ${'1.0.0'}   | ${'invalid'} | ${false}
      ${'v1.0.1'}  | ${'v1.0.0'}  | ${true}
      ${'v1.0.0'}  | ${'v1.0.1'}  | ${false}
      ${'v2.0.0'}  | ${'v1.9.9'}  | ${true}
      ${'v1.0.0'}  | ${'1.0.1'}   | ${false}
      ${'1.0.1'}   | ${'v1.0.0'}  | ${true}
      ${'v2.0.0'}  | ${'1.0.0'}   | ${true}
      ${'2.0.0'}   | ${'v1.0.0'}  | ${true}
      ${'v1.9.9'}  | ${'1.9.8'}   | ${true}
      ${'1.9.9'}   | ${'v1.9.8'}  | ${true}
      ${'v1.3'}    | ${'v1.2'}    | ${true}
      ${'v1.2'}    | ${'v1.3'}    | ${false}
      ${'v1.3.0'}  | ${'v1.2'}    | ${true}
      ${'v1.2'}    | ${'v1.2'}    | ${false}
      ${'v1'}      | ${'v1.2'}    | ${false}
      ${'v6'}      | ${'v5'}      | ${true}
      ${'v5'}      | ${'v6'}      | ${false}
      ${'v6.0.1'}  | ${'v6'}      | ${true}
      ${'v6'}      | ${'v6.0.1'}  | ${false}
    `(
      'isGreaterThan("$version", "$other") === $expected',
      ({ version, other, expected }) => {
        expect(githubActions.isGreaterThan(version, other)).toBe(expected);
      },
    );
  });

  describe('.sortVersions()', () => {
    it.each`
      a            | b            | expected
      ${'1.0.0'}   | ${'1.0.0'}   | ${0}
      ${'1.0.0'}   | ${'1.0.1'}   | ${-1}
      ${'1.0.1'}   | ${'1.0.0'}   | ${1}
      ${'2.0.0'}   | ${'1.9.9'}   | ${1}
      ${'invalid'} | ${'1.0.0'}   | ${0}
      ${'1.0.0'}   | ${'invalid'} | ${0}
      ${'invalid'} | ${'invalid'} | ${0}
      ${'v1.0.0'}  | ${'v1.0.0'}  | ${0}
      ${'v1.0.0'}  | ${'v1.0.1'}  | ${-1}
      ${'v1.0.1'}  | ${'v1.0.0'}  | ${1}
      ${'v1.0.0'}  | ${'1.0.0'}   | ${0}
      ${'1.0.0'}   | ${'v1.0.0'}  | ${0}
      ${'v1.0.0'}  | ${'1.0.1'}   | ${-1}
      ${'1.0.1'}   | ${'v1.0.0'}  | ${1}
      ${'v1.3'}    | ${'v1.2'}    | ${1}
      ${'v1.2'}    | ${'v1.3'}    | ${-1}
      ${'v1.2'}    | ${'v1.2'}    | ${0}
      ${'v1.3'}    | ${'v1.3.0'}  | ${0}
      ${'v6'}      | ${'v5'}      | ${1}
      ${'v5'}      | ${'v6'}      | ${-1}
      ${'v6'}      | ${'v6.0.0'}  | ${0}
    `('sortVersions("$a", "$b") === $expected', ({ a, b, expected }) => {
      expect(githubActions.sortVersions(a, b)).toBe(expected);
    });
  });

  describe('.isBreaking()', () => {
    it.each`
      version      | current      | expected
      ${'2.0.0'}   | ${'1.0.0'}   | ${true}
      ${'1.1.0'}   | ${'1.0.0'}   | ${false}
      ${'1.0.1'}   | ${'1.0.0'}   | ${false}
      ${'0.2.0'}   | ${'0.1.0'}   | ${true}
      ${'0.1.1'}   | ${'0.1.0'}   | ${false}
      ${'1.0.0'}   | ${'0.9.0'}   | ${true}
      ${'invalid'} | ${'1.0.0'}   | ${false}
      ${'1.0.0'}   | ${'invalid'} | ${false}
      ${'v2.0.0'}  | ${'v1.0.0'}  | ${true}
      ${'v1.1.0'}  | ${'v1.0.0'}  | ${false}
      ${'v0.2.0'}  | ${'v0.1.0'}  | ${true}
      ${'v2.0.0'}  | ${'1.0.0'}   | ${true}
      ${'2.0.0'}   | ${'v1.0.0'}  | ${true}
      ${'1.1.0'}   | ${'v1.0.0'}  | ${false}
      ${'v1.1.0'}  | ${'1.0.0'}   | ${false}
      ${'v1.0.0'}  | ${'0.9.0'}   | ${true}
      ${'1.0.0'}   | ${'v0.9.0'}  | ${true}
    `(
      'isBreaking("$version", "$current") === $expected',
      ({ version, current, expected }) => {
        expect(githubActions.isBreaking!(version, current)).toBe(expected);
      },
    );
  });

  describe('.isCompatible()', () => {
    it.each`
      version      | expected
      ${'1.0.0'}   | ${true}
      ${'1'}       | ${true}
      ${'~latest'} | ${false}
      ${'v1.0.0'}  | ${true}
      ${'v1'}      | ${true}
      ${'invalid'} | ${false}
    `('isCompatible("$version") === $expected', ({ version, expected }) => {
      expect(githubActions.isCompatible(version)).toBe(expected);
    });
  });

  describe('.getNewValue()', () => {
    it.each`
      currentValue | rangeStrategy | currentVersion | newVersion   | expected
      ${'1'}       | ${'pin'}      | ${'1.0.0'}     | ${'1.1.0'}   | ${'1.1.0'}
      ${'1.2'}     | ${'pin'}      | ${'1.2.0'}     | ${'1.2.1'}   | ${'1.2.1'}
      ${'1.2.3'}   | ${'pin'}      | ${'1.2.3'}     | ${'1.2.4'}   | ${'1.2.4'}
      ${'2'}       | ${'pin'}      | ${'2.0.0'}     | ${'2.1.0'}   | ${'2.1.0'}
      ${'2.5'}     | ${'pin'}      | ${'2.5.0'}     | ${'2.5.3'}   | ${'2.5.3'}
      ${'10'}      | ${'pin'}      | ${'10.0.0'}    | ${'10.1.0'}  | ${'10.1.0'}
      ${'~latest'} | ${'pin'}      | ${'1.0.0'}     | ${'1.1.0'}   | ${'1.1.0'}
      ${'1.0.0'}   | ${'pin'}      | ${'1.0.0'}     | ${'1.1.0'}   | ${'1.1.0'}
      ${'v1'}      | ${'pin'}      | ${'v1.0.0'}    | ${'v1.1.0'}  | ${'v1.1.0'}
      ${'v1.2'}    | ${'pin'}      | ${'v1.2.0'}    | ${'v1.2.1'}  | ${'v1.2.1'}
      ${'v1.2.3'}  | ${'pin'}      | ${'v1.2.3'}    | ${'v1.2.4'}  | ${'v1.2.4'}
      ${'v1'}      | ${'pin'}      | ${'v1.0.0'}    | ${'1.1.0'}   | ${'1.1.0'}
      ${'v1.2.3'}  | ${'pin'}      | ${'v1.2.3'}    | ${'1.2.4'}   | ${'1.2.4'}
      ${'1'}       | ${'pin'}      | ${'1.0.0'}     | ${'v1.1.0'}  | ${'v1.1.0'}
      ${'1.2.3'}   | ${'pin'}      | ${'1.2.3'}     | ${'v1.2.4'}  | ${'v1.2.4'}
      ${'1'}       | ${'replace'}  | ${'1.0.0'}     | ${'1.1.0'}   | ${'1'}
      ${'1'}       | ${'replace'}  | ${'1.0.0'}     | ${'2.0.0'}   | ${'2'}
      ${'1.2'}     | ${'replace'}  | ${'1.2.0'}     | ${'1.2.1'}   | ${'1.2'}
      ${'1.2'}     | ${'replace'}  | ${'1.2.0'}     | ${'1.3.0'}   | ${'1.3'}
      ${'1.2.3'}   | ${'replace'}  | ${'1.2.3'}     | ${'1.2.4'}   | ${'1.2.4'}
      ${'1.2.3'}   | ${'replace'}  | ${'1.2.3'}     | ${'1.3.0'}   | ${'1.3.0'}
      ${'1'}       | ${'replace'}  | ${'1.0.0'}     | ${'1.2.0'}   | ${'1'}
      ${'1.2'}     | ${'replace'}  | ${'1.2.0'}     | ${'2.0.0'}   | ${'2.0'}
      ${'2'}       | ${'replace'}  | ${'2.0.0'}     | ${'3.0.0'}   | ${'3'}
      ${'2.1'}     | ${'replace'}  | ${'2.1.0'}     | ${'2.2.0'}   | ${'2.2'}
      ${'10.5'}    | ${'replace'}  | ${'10.5.0'}    | ${'10.6.0'}  | ${'10.6'}
      ${'~latest'} | ${'replace'}  | ${'1.0.0'}     | ${'2.0.0'}   | ${'2.0.0'}
      ${'1.0.0'}   | ${'replace'}  | ${'1.0.0'}     | ${'1.1.0'}   | ${'1.1.0'}
      ${'1'}       | ${'replace'}  | ${'1.0.0'}     | ${'invalid'} | ${'invalid'}
      ${'v1'}      | ${'replace'}  | ${'v1.0.0'}    | ${'v1.1.0'}  | ${'v1'}
      ${'v1'}      | ${'replace'}  | ${'v1.0.0'}    | ${'v2.0.0'}  | ${'v2'}
      ${'v1.2'}    | ${'replace'}  | ${'v1.2.0'}    | ${'v1.2.1'}  | ${'v1.2'}
      ${'v1.2'}    | ${'replace'}  | ${'v1.2.0'}    | ${'v1.3.0'}  | ${'v1.3'}
      ${'v1.2.3'}  | ${'replace'}  | ${'v1.2.3'}    | ${'v1.2.4'}  | ${'v1.2.4'}
      ${'v1.2.3'}  | ${'replace'}  | ${'v1.2.3'}    | ${'v1.3.0'}  | ${'v1.3.0'}
      ${'v1'}      | ${'replace'}  | ${'v1.0.0'}    | ${'v1.2.0'}  | ${'v1'}
      ${'v2'}      | ${'replace'}  | ${'v2.0.0'}    | ${'v3.0.0'}  | ${'v3'}
      ${'v1'}      | ${'replace'}  | ${'v1.0.0'}    | ${'1.1.0'}   | ${'v1'}
      ${'v1'}      | ${'replace'}  | ${'v1.0.0'}    | ${'2.0.0'}   | ${'v2'}
      ${'v1.2.3'}  | ${'replace'}  | ${'v1.2.3'}    | ${'1.2.4'}   | ${'1.2.4'}
      ${'1'}       | ${'replace'}  | ${'1.0.0'}     | ${'v1.1.0'}  | ${'1'}
      ${'1'}       | ${'replace'}  | ${'1.0.0'}     | ${'v2.0.0'}  | ${'2'}
      ${'1.2.3'}   | ${'replace'}  | ${'1.2.3'}     | ${'v1.2.4'}  | ${'v1.2.4'}
    `(
      'getNewValue("$currentValue", "$rangeStrategy", "$currentVersion", "$newVersion") === "$expected"',
      ({
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
        expected,
      }) => {
        expect(
          githubActions.getNewValue({
            currentValue,
            rangeStrategy,
            currentVersion,
            newVersion,
          }),
        ).toBe(expected);
      },
    );

    describe('allVersions', () => {
      it('does not determine if the proposed newVersion exists, if allVersions is not set', () => {
        const res = githubActions.getNewValue({
          currentValue: 'v7',
          currentVersion: 'v7.6.0',
          newVersion: 'v8.1.0',
          rangeStrategy: 'replace',
        });
        // NOTE that this may not actually be valid, depending on whether the Action is using Immutable Tags, which requires full SemVer pinning
        expect(res).toEqual('v8');
      });

      // because this is not a valid case - if there were no versions, we'd not be called
      it.each([
        ['v7', 'v8'],
        ['v7.6.1', 'v8.1.0'],
      ])(
        'does not determine if the proposed newVersion exists, if allVersions is an empty array: %s -> %s',
        (currentValue, expected) => {
          const res = githubActions.getNewValue({
            currentValue,
            currentVersion: 'v7.6.0',
            newVersion: 'v8.1.0',
            rangeStrategy: 'replace',
            allVersions: new Set(),
          });
          // NOTE that this may not actually be valid, depending on whether the Action is using Immutable Tags, which requires full SemVer pinning
          expect(res).toEqual(expected);
        },
      );

      it.each([
        {
          description: 'when a major version exists',
          availableVersions: ['v8.0.0'],
          expected: 'v8.0.0',
        },
        {
          description: 'when a minor version exists',
          availableVersions: [
            'v8.0.0', // ignored
            'v8.0',
          ],
          expected: 'v8.0',
        },
        {
          description: 'when a patch version exists',
          availableVersions: ['v8.0.0'],
          expected: 'v8.0.0',
        },
      ])('%s', ({ availableVersions, expected }) => {
        const res = githubActions.getNewValue({
          currentValue: 'v7',
          currentVersion: 'v7.6.0',
          newVersion: 'v8.0.0',
          rangeStrategy: 'replace',
          allVersions: new Set(['v7.5.0', 'v7.6.0', ...availableVersions]),
        });
        expect(res).toEqual(expected);
      });

      it.each([
        {
          description:
            'newVersion is full semver, no floating minor in allVersions',
          newVersion: 'v7.6.0',
          allVersions: ['v7.5.0', 'v7.6.0'],
        },
        {
          description:
            'newVersion is full semver, floating minor tag also in allVersions',
          newVersion: 'v7.6.0',
          allVersions: ['v7.5.0', 'v7.6', 'v7.6.0'],
        },
        {
          description:
            'newVersion is itself a floating minor (v7.6) — real-world case when floating tags sort equal to their full-semver counterpart',
          newVersion: 'v7.6',
          allVersions: [
            'v7.5.0',
            'v7.6',
            'v7.6.0',
            // only if the v7 tag exists
            'v7',
          ],
        },
        {
          description:
            'newVersion is floating minor with no full semver counterpart in allVersions',
          newVersion: 'v7.6',
          allVersions: [
            'v7.5.0',
            'v7.6',
            // only if the v7 tag exists
            'v7',
          ],
        },
      ])(
        'preserves floating major for non-major updates ($description)',
        ({ newVersion, allVersions }) => {
          // When the user has @v7, they want to track the major. A non-major update
          // should NOT narrow them to @v7.6 — the floating major should be preserved.
          const res = githubActions.getNewValue({
            currentValue: 'v7',
            currentVersion: 'v7.0.0',
            newVersion,
            rangeStrategy: 'replace',
            allVersions: new Set(allVersions),
          });
          expect(res).toEqual('v7');
        },
      );

      it('migrates from a floating major to a floating major.minor if the floating major no longer exists', () => {
        const res = githubActions.getNewValue({
          currentValue: 'v7',
          currentVersion: 'v7.0.0',
          newVersion: 'v7.6',
          rangeStrategy: 'replace',
          allVersions: new Set(['v7.5.0', 'v7.6', 'v7.6.0']),
        });
        expect(res).toEqual('v7.6');
      });

      it.each([
        {
          description: 'only full semver available',
          allVersions: ['v7.5.0', 'v7.6.0'],
          expected: 'v7.6.0',
        },
        {
          description: 'floating minor tag available (v7.6)',
          allVersions: ['v7.5.0', 'v7.6', 'v7.6.0'],
          expected: 'v7.6',
        },
        {
          description:
            'floating major tag present but ignored (must not go less specific)',
          allVersions: ['v7', 'v7.5.0', 'v7.6', 'v7.6.0'],
          expected: 'v7.6',
        },
      ])(
        'preserves floating minor for non-major updates ($description)',
        ({ allVersions, expected }) => {
          // When the user has @v7.5, Renovate should stay at the minor level.
          // It must NOT return v7 (less specific), even if v7 appears in allVersions.
          const res = githubActions.getNewValue({
            currentValue: 'v7.5',
            currentVersion: 'v7.5.0',
            newVersion: 'v7.6.0',
            rangeStrategy: 'replace',
            allVersions: new Set(allVersions),
          });
          expect(res).toEqual(expected);
        },
      );

      it('when a release candidate version exists, that exact version is used', () => {
        const res = githubActions.getNewValue({
          currentValue: 'v7',
          currentVersion: 'v7.6.0',
          newVersion: 'v8.0.0-rc3',
          rangeStrategy: 'replace',
          allVersions: new Set([
            'v7.5.0',
            'v7.6.0',
            'v8.0.0-rc1',
            'v8.0.0-rc2',
            'v8.0.0-rc3',
          ]),
        });
        expect(res).toEqual('v8.0.0-rc3');
      });

      it('returns newVersion when newVersion is a floating tag and allVersions is not set', () => {
        const res = githubActions.getNewValue({
          currentValue: 'v7',
          currentVersion: 'v7.6.0',
          newVersion: 'v8',
          rangeStrategy: 'replace',
        });
        expect(res).toEqual('v8');
      });

      it('returns the floating newVersion when it exists in allVersions', () => {
        const res = githubActions.getNewValue({
          currentValue: 'v7',
          currentVersion: 'v7.6.0',
          newVersion: 'v8',
          rangeStrategy: 'replace',
          allVersions: new Set(['v7.6.0', 'v8']),
        });
        expect(res).toEqual('v8');
      });

      describe('if the newVersion is not found in allVersions', () => {
        // because this is not a valid case - if the newVersion wasn't found in allVersions, how would we have been called?
        it('newVersion is returned anyway', () => {
          const res = githubActions.getNewValue({
            currentValue: 'v7',
            currentVersion: 'v7.6.0',
            newVersion: 'v8.5.0',
            rangeStrategy: 'replace',
            allVersions: new Set(['v7.5.0', 'v7.6.0']),
          });
          expect(res).toEqual('v8.5.0');
        });

        it('debug logs', () => {
          githubActions.getNewValue({
            currentValue: 'v7',
            currentVersion: 'v7.6.0',
            newVersion: 'v8.5.0',
            rangeStrategy: 'replace',
            allVersions: new Set(['v7.5.0', 'v7.6.0']),
          });

          expect(logger.logger.once.debug).toHaveBeenCalledWith(
            {
              versioning: 'github-actions',
              currentValue: 'v7',
              currentVersion: 'v7.6.0',
              newVersion: 'v8.5.0',
              rangeStrategy: 'replace',
              allVersions: new Set(['v7.5.0', 'v7.6.0']),
            },
            'Suggested newValue `v8.5.0` was not included in allVersions, but it should have been. Returning it anyway',
          );
        });
      });
    });
  });
});
