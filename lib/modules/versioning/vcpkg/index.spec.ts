import { coerce } from 'semver';
import vcpkg from './index.ts';

describe('modules/versioning/vcpkg/index', () => {
  describe('.isValid(input)', () => {
    it.each`
      input                             | expected
      ${'1.2.3'}                        | ${true}
      ${'1.2.3-rc.1'}                   | ${true}
      ${'1.2.3-rc.1+build.7'}           | ${true}
      ${'1.2.3#1'}                      | ${true}
      ${'1.2.3#0'}                      | ${true}
      ${'1.2.3#42'}                     | ${true}
      ${'1.2'}                          | ${true}
      ${'1'}                            | ${true}
      ${'1.2.3.4'}                      | ${true}
      ${'1.2.3.4.5'}                    | ${true}
      ${'1.2-alpha'}                    | ${true}
      ${'2024-01-15'}                   | ${true}
      ${'2024-01-15#3'}                 | ${true}
      ${'2024-01-15.1'}                 | ${true}
      ${'2024-01-15.0'}                 | ${true}
      ${'2024-01-15.1.2.3'}             | ${true}
      ${'2024-02-29'}                   | ${true}
      ${'2023-02-29'}                   | ${false}
      ${'2024-13-01'}                   | ${false}
      ${'2024-02-31'}                   | ${false}
      ${'2024-1-1'}                     | ${true}
      ${'bla-bla-2024-08-fixed-typo'}   | ${true}
      ${'bla-bla-2024-08-fixed-typo#2'} | ${true}
      ${'2024.08.fixed'}                | ${true}
      ${'opaque'}                       | ${true}
      ${'opaque#5'}                     | ${true}
      ${''}                             | ${false}
      ${'   '}                          | ${false}
      ${'#1'}                           | ${false}
      ${'1.2.3#'}                       | ${true}
      ${'1.2.3#abc'}                    | ${true}
      ${null as unknown as string}      | ${false}
      ${undefined as unknown as string} | ${false}
    `('isValid("$input") === $expected', ({ input, expected }) => {
      expect(vcpkg.isValid(input)).toBe(expected);
    });

    it('rejects non-string input', () => {
      expect(vcpkg.isValid(123 as unknown as string)).toBeFalse();
    });
  });

  describe('.isVersion(input)', () => {
    it.each`
      input                      | expected
      ${'1.2.3'}                 | ${true}
      ${'1.2'}                   | ${true}
      ${'1.2.3.4'}               | ${true}
      ${'2024-01-15'}            | ${true}
      ${'2024-01-15#3'}          | ${true}
      ${'bla-bla-2024-08-fixed'} | ${false}
      ${'opaque#3'}              | ${false}
      ${''}                      | ${false}
      ${null}                    | ${false}
      ${undefined}               | ${false}
    `('isVersion("$input") === $expected', ({ input, expected }) => {
      expect(vcpkg.isVersion(input)).toBe(expected);
    });
  });

  describe('.isCompatible(version)', () => {
    it('mirrors isValid', () => {
      expect(vcpkg.isCompatible('1.2.3')).toBeTrue();
      expect(vcpkg.isCompatible('1.2.3#7')).toBeTrue();
      expect(vcpkg.isCompatible('opaque')).toBeTrue();
      expect(vcpkg.isCompatible('')).toBeFalse();
    });
  });

  describe('.isSingleVersion(version)', () => {
    it('returns true for ordered schemes only', () => {
      expect(vcpkg.isSingleVersion('1.2.3')).toBeTrue();
      expect(vcpkg.isSingleVersion('1.2.3.4')).toBeTrue();
      expect(vcpkg.isSingleVersion('2024-01-15')).toBeTrue();
      expect(vcpkg.isSingleVersion('opaque')).toBeFalse();
    });
  });

  describe('.isStable(version)', () => {
    it.each`
      input             | expected
      ${'1.2.3'}        | ${true}
      ${'1.2.3-rc.1'}   | ${false}
      ${'1.2.3-rc.1#1'} | ${false}
      ${'1.2'}          | ${true}
      ${'1.2-alpha'}    | ${false}
      ${'2024-01-15'}   | ${true}
      ${'opaque-tag'}   | ${true}
      ${'bogus_input!'} | ${true}
      ${''}             | ${false}
    `('isStable("$input") === $expected', ({ input, expected }) => {
      expect(vcpkg.isStable(input)).toBe(expected);
    });
  });

  describe('.getMajor/getMinor/getPatch(version)', () => {
    it.each`
      input           | major   | minor   | patch
      ${'1.2.3'}      | ${1}    | ${2}    | ${3}
      ${'1.2.3#4'}    | ${1}    | ${2}    | ${3}
      ${'1.2.3-rc.1'} | ${1}    | ${2}    | ${3}
      ${'1.2'}        | ${1}    | ${2}    | ${0}
      ${'1.2.3.4'}    | ${1}    | ${2}    | ${3}
      ${'5'}          | ${5}    | ${0}    | ${0}
      ${'2024-01-15'} | ${null} | ${null} | ${null}
      ${'opaque'}     | ${null} | ${null} | ${null}
      ${''}           | ${null} | ${null} | ${null}
    `('getMajor("$input")', ({ input, major, minor, patch }) => {
      expect(vcpkg.getMajor(input)).toBe(major);
      expect(vcpkg.getMinor(input)).toBe(minor);
      expect(vcpkg.getPatch(input)).toBe(patch);
    });

    it('accepts SemVer object input', () => {
      const sv = coerce('1.2.3')!;
      expect(vcpkg.getMajor(sv)).toBe(1);
      expect(vcpkg.getMinor(sv)).toBe(2);
      expect(vcpkg.getPatch(sv)).toBe(3);
    });
  });

  describe('.equals(a, b)', () => {
    it.each`
      a                  | b                  | expected
      ${'1.2.3'}         | ${'1.2.3'}         | ${true}
      ${'1.2.3'}         | ${'1.2.3#0'}       | ${true}
      ${'1.2.3#0'}       | ${'1.2.3'}         | ${true}
      ${'1.2.3#1'}       | ${'1.2.3#1'}       | ${true}
      ${'1.2.3#1'}       | ${'1.2.3#2'}       | ${false}
      ${'1.2.3'}         | ${'1.2.4'}         | ${false}
      ${'1.2.3+build.7'} | ${'1.2.3+build.9'} | ${true}
      ${'1.2'}           | ${'1.2.0'}         | ${false}
      ${'2024-01-15'}    | ${'2024-01-15'}    | ${true}
      ${'2024-01-15'}    | ${'2024-01-15#0'}  | ${true}
      ${'2024-01-15#1'}  | ${'2024-01-16#1'}  | ${false}
      ${'opaque'}        | ${'opaque'}        | ${true}
      ${'opaque#1'}      | ${'opaque#1'}      | ${true}
      ${'opaque#1'}      | ${'opaque#2'}      | ${false}
      ${'opaque'}        | ${'other'}         | ${false}
      ${'1.2.3'}         | ${'2024-01-15'}    | ${false}
      ${'1.2.3'}         | ${'opaque'}        | ${false}
      ${''}              | ${'1.2.3'}         | ${false}
      ${'1.2.3'}         | ${''}              | ${false}
    `('equals("$a", "$b") === $expected', ({ a, b, expected }) => {
      expect(vcpkg.equals(a, b)).toBe(expected);
    });
  });

  describe('.isGreaterThan(version, other)', () => {
    it.each`
      a                 | b               | expected
      ${'1.2.4'}        | ${'1.2.3'}      | ${true}
      ${'1.2.3'}        | ${'1.2.4'}      | ${false}
      ${'1.2.3'}        | ${'1.2.3'}      | ${false}
      ${'1.2.3#1'}      | ${'1.2.3#0'}    | ${true}
      ${'1.2.3#1'}      | ${'1.2.3'}      | ${true}
      ${'1.2.3'}        | ${'1.2.3#1'}    | ${false}
      ${'1.2.4'}        | ${'1.2.3#1'}    | ${true}
      ${'1.2.3#1'}      | ${'1.2.4'}      | ${false}
      ${'1.2.3.4'}      | ${'1.2.3.3'}    | ${true}
      ${'1.2.3.4'}      | ${'1.2.3'}      | ${true}
      ${'2024-01-16'}   | ${'2024-01-15'} | ${true}
      ${'2024-01-15'}   | ${'2024-01-16'} | ${false}
      ${'2024-01-15#1'} | ${'2024-01-15'} | ${true}
      ${'opaque'}       | ${'other'}      | ${false}
      ${'opaque#2'}     | ${'opaque#1'}   | ${false}
      ${'1.2.3'}        | ${'2024-01-15'} | ${false}
      ${'1.2.3'}        | ${'opaque'}     | ${false}
      ${''}             | ${'1.2.3'}      | ${false}
      ${'1.2.3'}        | ${''}           | ${false}
    `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
      expect(vcpkg.isGreaterThan(a, b)).toBe(expected);
    });
  });

  describe('.sortVersions(a, b)', () => {
    it('orders semver bases', () => {
      const versions = ['1.10.0', '1.2.0', '1.2.1', '2.0.0'];
      expect([...versions].sort(vcpkg.sortVersions)).toEqual([
        '1.2.0',
        '1.2.1',
        '1.10.0',
        '2.0.0',
      ]);
    });

    it('orders relaxed-dotted bases', () => {
      const versions = ['1.2', '1.2.3', '1.2.3.4', '1.10'];
      expect([...versions].sort(vcpkg.sortVersions)).toEqual([
        '1.2',
        '1.2.3',
        '1.2.3.4',
        '1.10',
      ]);
    });

    it('orders date bases lexicographically', () => {
      const versions = ['2024-12-31', '2023-01-01', '2024-01-01'];
      expect([...versions].sort(vcpkg.sortVersions)).toEqual([
        '2023-01-01',
        '2024-01-01',
        '2024-12-31',
      ]);
    });

    it('orders date disambiguation tails per the relaxed `version` rule', () => {
      // Per the spec, a version with the smallest set of sections takes
      // precedence, so a bare date sorts before any disambiguated form.
      const versions = [
        '2024-01-15.1.3',
        '2024-01-15',
        '2024-01-15.1.2',
        '2024-01-15.2',
        '2024-01-15.1',
      ];
      expect([...versions].sort(vcpkg.sortVersions)).toEqual([
        '2024-01-15',
        '2024-01-15.1',
        '2024-01-15.1.2',
        '2024-01-15.1.3',
        '2024-01-15.2',
      ]);
    });

    it('breaks date ties by date head before tail', () => {
      expect(vcpkg.sortVersions('2024-01-15.99', '2024-01-16')).toBeLessThan(0);
    });

    it('uses port-version as a tie-breaker after equal base', () => {
      expect(vcpkg.sortVersions('1.2.3#0', '1.2.3#1')).toBeLessThan(0);
      expect(vcpkg.sortVersions('1.2.3#5', '1.2.3#2')).toBeGreaterThan(0);
      expect(vcpkg.sortVersions('1.2.3#5', '1.2.3#5')).toBe(0);
    });

    it('returns 0 for unparseable inputs', () => {
      expect(vcpkg.sortVersions('', '1.2.3')).toBe(0);
      expect(vcpkg.sortVersions('1.2.3', '')).toBe(0);
    });

    it('returns 0 for cross-scheme base comparison', () => {
      expect(vcpkg.sortVersions('1.2.3', '2024-01-15')).toBe(0);
    });

    it('orders opaque-string bases only by port-version', () => {
      expect(vcpkg.sortVersions('foo#0', 'foo#1')).toBeLessThan(0);
      expect(vcpkg.sortVersions('foo', 'bar')).toBe(0);
    });
  });

  describe('.matches(version, range)', () => {
    it.each`
      version         | range           | expected
      ${'1.2.3'}      | ${'1.2.3'}      | ${true}
      ${'1.2.4'}      | ${'1.2.3'}      | ${true}
      ${'1.2.3'}      | ${'1.2.4'}      | ${false}
      ${'1.2.3#1'}    | ${'1.2.3#0'}    | ${true}
      ${'1.2.3#0'}    | ${'1.2.3#1'}    | ${false}
      ${'2024-02-01'} | ${'2024-01-15'} | ${true}
      ${'2024-01-15'} | ${'2024-02-01'} | ${false}
      ${'opaque'}     | ${'opaque'}     | ${true}
      ${'opaque#3'}   | ${'opaque#1'}   | ${true}
      ${'opaque#1'}   | ${'opaque#3'}   | ${false}
      ${'opaque'}     | ${'other'}      | ${false}
      ${'1.2.3'}      | ${'2024-01-15'} | ${false}
      ${''}           | ${'1.2.3'}      | ${false}
    `(
      'matches("$version", "$range") === $expected',
      ({ version, range, expected }) => {
        expect(vcpkg.matches(version, range)).toBe(expected);
      },
    );
  });

  describe('.getSatisfyingVersion(versions, range)', () => {
    it('returns the highest version satisfying the `>=` constraint', () => {
      // Out-of-order list so the iteration exercises both the "new best" and
      // the "already covered" branches of the loop.
      const versions = ['1.2.3', '2.0.0', '1.2.3#1', '1.2.4'];
      expect(vcpkg.getSatisfyingVersion(versions, '1.2.3')).toBe('2.0.0');
      expect(vcpkg.getSatisfyingVersion(versions, '1.2.4')).toBe('2.0.0');
      expect(vcpkg.getSatisfyingVersion(versions, '2.0.0')).toBe('2.0.0');
      expect(vcpkg.getSatisfyingVersion(versions, '3.0.0')).toBeNull();
    });

    it('returns null for empty list', () => {
      expect(vcpkg.getSatisfyingVersion([], '1.2.3')).toBeNull();
    });

    it('ignores unparseable candidates', () => {
      const versions = ['1.2.3', '', '1.2.4'];
      expect(vcpkg.getSatisfyingVersion(versions, '1.2.3')).toBe('1.2.4');
    });
  });

  describe('.minSatisfyingVersion(versions, range)', () => {
    it('returns the lowest version satisfying the `>=` constraint', () => {
      const versions = ['1.2.4', '1.2.3', '1.2.3#1', '2.0.0'];
      expect(vcpkg.minSatisfyingVersion(versions, '1.2.3')).toBe('1.2.3');
      expect(vcpkg.minSatisfyingVersion(versions, '1.2.4')).toBe('1.2.4');
      expect(vcpkg.minSatisfyingVersion(versions, '3.0.0')).toBeNull();
    });

    it('returns null for empty list', () => {
      expect(vcpkg.minSatisfyingVersion([], '1.2.3')).toBeNull();
    });
  });

  describe('.getNewValue(config)', () => {
    it('returns newVersion unchanged for pinned values', () => {
      expect(
        vcpkg.getNewValue({
          currentValue: '1.2.3',
          newVersion: '1.2.4',
          rangeStrategy: 'replace',
        }),
      ).toBe('1.2.4');
      expect(
        vcpkg.getNewValue({
          currentValue: '1.2.3#0',
          newVersion: '1.2.3#1',
          rangeStrategy: 'replace',
        }),
      ).toBe('1.2.3#1');
      expect(
        vcpkg.getNewValue({
          currentValue: '2024-01-15',
          newVersion: '2024-02-20',
          rangeStrategy: 'replace',
        }),
      ).toBe('2024-02-20');
    });
  });
});
