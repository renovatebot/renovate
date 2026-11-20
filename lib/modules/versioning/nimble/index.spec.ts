import { describe, expect, it } from 'vitest';
import { api as nimble, nimble2npm } from './index.ts';

describe('modules/versioning/nimble/index', () => {
  describe('nimble2npm', () => {
    it.each`
      input                     | expected
      ${''}                     | ${null}
      ${'   '}                  | ${null}
      ${'#head'}                | ${null}
      ${'any'}                  | ${'*'}
      ${'*'}                    | ${'*'}
      ${'1.2.3'}                | ${'1.2.3'}
      ${'1.2'}                  | ${'1.2.0'}
      ${'1'}                    | ${'1.0.0'}
      ${'== 1.2.3'}             | ${'1.2.3'}
      ${'= 1.2.3'}              | ${'1.2.3'}
      ${'>= 0.14.0'}            | ${'>=0.14.0'}
      ${'<= 2.0.0'}             | ${'<=2.0.0'}
      ${'> 1.0.0'}              | ${'>1.0.0'}
      ${'< 2.0.0'}              | ${'<2.0.0'}
      ${'^= 1.2.3'}             | ${'>=1.2.3 <2.0.0'}
      ${'^= 0.2.3'}             | ${'>=0.2.3 <0.3.0'}
      ${'^= 0.0.3'}             | ${'>=0.0.3 <0.0.4'}
      ${'^= 1'}                 | ${'>=1.0.0 <2.0.0'}
      ${'~= 1.2.3'}             | ${'>=1.2.3 <1.3.0'}
      ${'~= 1.2'}               | ${'>=1.2.0 <2.0.0'}
      ${'>= 0.14.0 & < 0.15.0'} | ${'>=0.14.0 <0.15.0'}
      ${'>= 1.0 & < 2.0 & < 3'} | ${null}
      ${'>= 1.0 & #head'}       | ${null}
      ${'invalid range here'}   | ${null}
      ${'>= not-a-ver'}         | ${null}
    `('nimble2npm("$input") === $expected', ({ input, expected }) => {
      expect(nimble2npm(input)).toBe(expected);
    });
  });

  describe('isVersion', () => {
    it.each`
      version          | expected
      ${''}            | ${false}
      ${'#head'}       | ${false}
      ${'>= 1.0.0'}    | ${false}
      ${'1.0.0 & 2.0'} | ${false}
      ${'1.0.0 2.0.0'} | ${false}
      ${'not-a-ver'}   | ${false}
      ${'1.2.3'}       | ${true}
      ${'v1.2.3'}      | ${true}
      ${'V1.2.3'}      | ${true}
      ${'1.2'}         | ${true}
      ${'1'}           | ${true}
      ${'1.0.0-rc1'}   | ${true}
    `('isVersion("$version") === $expected', ({ version, expected }) => {
      expect(nimble.isVersion(version)).toBe(expected);
    });
  });

  describe('isValid', () => {
    it.each`
      input                     | expected
      ${''}                     | ${false}
      ${'#head'}                | ${false}
      ${'1.2.3'}                | ${true}
      ${'v1.2.3'}               | ${true}
      ${'== 1.2.3'}             | ${true}
      ${'>= 0.14.0'}            | ${true}
      ${'^= 1.2.3'}             | ${true}
      ${'~= 1.2.3'}             | ${true}
      ${'>= 0.14.0 & < 0.15.0'} | ${true}
      ${'>= 1.0 & < 2.0 & < 3'} | ${false}
    `('isValid("$input") === $expected', ({ input, expected }) => {
      expect(nimble.isValid(input)).toBe(expected);
    });
  });

  describe('isSingleVersion', () => {
    it.each`
      input                | expected
      ${''}                | ${false}
      ${'1.2.3'}           | ${true}
      ${'v1.2.3'}          | ${true}
      ${'== 1.2.3'}        | ${true}
      ${'==1.2.3'}         | ${true}
      ${'= 1.2.3'}         | ${true}
      ${'== not-a-ver'}    | ${false}
      ${'>= 1.2.3'}        | ${false}
      ${'^= 1.2.3'}        | ${false}
      ${'1.2.3 & < 2.0.0'} | ${false}
    `('isSingleVersion("$input") === $expected', ({ input, expected }) => {
      expect(nimble.isSingleVersion(input)).toBe(expected);
    });
  });

  describe('isStable, getMajor, getMinor, getPatch, equals, isGreaterThan, sortVersions', () => {
    it('evaluates version stability and components with v-prefixes and short versions', () => {
      expect(nimble.isStable('1.2.3')).toBeTrue();
      expect(nimble.isStable('v1.2')).toBeTrue();
      expect(nimble.isStable('1.2.3-rc1')).toBeFalse();
      expect(nimble.isStable('not-a-ver')).toBeFalse();

      expect(nimble.getMajor('v2.3.4')).toBe(2);
      expect(nimble.getMinor('v2.3')).toBe(3);
      expect(nimble.getPatch('v2')).toBe(0);
      expect(nimble.getMajor('not-a-ver')).toBeNull();
      expect(nimble.getMinor('not-a-ver')).toBeNull();
      expect(nimble.getPatch('not-a-ver')).toBeNull();

      expect(nimble.equals('v1.2.0', '1.2')).toBeTrue();
      expect(nimble.equals('1.2.0', '1.2.1')).toBeFalse();
      expect(nimble.equals('not-a-ver', '1.2.0')).toBeFalse();

      expect(nimble.isGreaterThan('v1.3.0', '1.2.0')).toBeTrue();
      expect(nimble.isGreaterThan('1.2.0', 'v1.3.0')).toBeFalse();
      expect(nimble.isGreaterThan('not-a-ver', '1.2.0')).toBeFalse();

      expect(nimble.sortVersions('v1.0.0', '2.0.0')).toBeLessThan(0);
      expect(nimble.sortVersions('2.0.0', 'v1.0.0')).toBeGreaterThan(0);
      expect(nimble.sortVersions('not-a-ver', '1.0.0')).toBe(0);
    });
  });

  describe('matches, isLessThanRange, getSatisfyingVersion, minSatisfyingVersion', () => {
    it.each`
      version      | range                     | expected
      ${'v0.14.1'} | ${'>= 0.14.0 & < 0.15.0'} | ${true}
      ${'v0.15.0'} | ${'>= 0.14.0 & < 0.15.0'} | ${false}
      ${'1.2.5'}   | ${'^= 1.2.0'}             | ${true}
      ${'2.0.0'}   | ${'^= 1.2.0'}             | ${false}
      ${'0.2.5'}   | ${'^= 0.2.0'}             | ${true}
      ${'0.3.0'}   | ${'^= 0.2.0'}             | ${false}
      ${'1.2.9'}   | ${'~= 1.2.3'}             | ${true}
      ${'1.3.0'}   | ${'~= 1.2.3'}             | ${false}
      ${'1.9.0'}   | ${'~= 1.2'}               | ${true}
      ${'2.0.0'}   | ${'~= 1.2'}               | ${false}
      ${'invalid'} | ${'>= 1.0.0'}             | ${false}
      ${'1.0.0'}   | ${'#head'}                | ${false}
    `(
      'matches("$version", "$range") === $expected',
      ({ version, range, expected }) => {
        expect(nimble.matches(version, range)).toBe(expected);
      },
    );

    it('evaluates isLessThanRange', () => {
      expect(
        nimble.isLessThanRange!('v0.13.0', '>= 0.14.0 & < 0.15.0'),
      ).toBeTrue();
      expect(
        nimble.isLessThanRange!('v0.14.1', '>= 0.14.0 & < 0.15.0'),
      ).toBeFalse();
      expect(nimble.isLessThanRange!('invalid', '>= 0.14.0')).toBeFalse();
      expect(nimble.isLessThanRange!('0.13.0', '#head')).toBeFalse();
    });

    it('finds getSatisfyingVersion and minSatisfyingVersion preserving original tag strings', () => {
      const versions = ['v0.13.0', 'v0.14.0', 'v0.14.1', 'v0.15.0'];
      expect(
        nimble.getSatisfyingVersion(versions, '>= 0.14.0 & < 0.15.0'),
      ).toBe('v0.14.1');
      expect(
        nimble.minSatisfyingVersion(versions, '>= 0.14.0 & < 0.15.0'),
      ).toBe('v0.14.0');
      expect(nimble.getSatisfyingVersion(versions, '>= 1.0.0')).toBeNull();
      expect(nimble.minSatisfyingVersion(versions, '>= 1.0.0')).toBeNull();
    });
  });

  describe('getPinnedValue and getNewValue', () => {
    it('returns pinned value with == and stripped v-prefix', () => {
      expect(nimble.getPinnedValue!('v1.2.3')).toBe('== 1.2.3');
    });

    it.each`
      currentValue              | rangeStrategy        | newVersion   | expected
      ${''}                     | ${'replace'}         | ${'1.0.0'}   | ${''}
      ${'*'}                    | ${'replace'}         | ${'1.0.0'}   | ${'*'}
      ${'any'}                  | ${'replace'}         | ${'1.0.0'}   | ${'any'}
      ${'#head'}                | ${'replace'}         | ${'1.0.0'}   | ${'#head'}
      ${'>= 1.0.0'}             | ${'replace'}         | ${'not-ver'} | ${'>= 1.0.0'}
      ${'>= 0.14.0'}            | ${'pin'}             | ${'v0.14.1'} | ${'== 0.14.1'}
      ${'0.14.0'}               | ${'replace'}         | ${'v0.14.1'} | ${'0.14.1'}
      ${'== 0.14.0'}            | ${'replace'}         | ${'v0.14.1'} | ${'== 0.14.1'}
      ${'= 0.14.0'}             | ${'bump'}            | ${'v0.14.1'} | ${'= 0.14.1'}
      ${'>= 0.14.0'}            | ${'replace'}         | ${'v0.14.1'} | ${'>= 0.14.0'}
      ${'>= 0.14.0'}            | ${'bump'}            | ${'v0.14.1'} | ${'>= 0.14.1'}
      ${'>=0.14.0'}             | ${'bump'}            | ${'v0.14.1'} | ${'>=0.14.1'}
      ${'>= 0.14.0'}            | ${'widen'}           | ${'v0.15.0'} | ${'>= 0.14.0'}
      ${'>= 0.14.0 & < 0.15.0'} | ${'replace'}         | ${'v0.14.1'} | ${'>= 0.14.0 & < 0.15.0'}
      ${'>= 0.14.0 & < 0.15.0'} | ${'bump'}            | ${'v0.14.1'} | ${'>= 0.14.1 & < 0.15.0'}
      ${'>= 0.14.0 & < 0.15.0'} | ${'bump'}            | ${'v0.15.2'} | ${'>= 0.15.2 & < 0.16.0'}
      ${'>= 0.14.0 & < 0.15.0'} | ${'replace'}         | ${'v0.15.2'} | ${'>= 0.15.2 & < 0.16.0'}
      ${'>= 0.14.0 & < 0.15.0'} | ${'widen'}           | ${'v0.15.2'} | ${'>= 0.14.0 & < 0.16.0'}
      ${'>=0.14.0&<0.15.0'}     | ${'bump'}            | ${'v0.14.1'} | ${'>=0.14.1&<0.15.0'}
      ${'>= 0.14.0 & < 0.15.0'} | ${'update-lockfile'} | ${'v0.14.1'} | ${'>= 0.14.0 & < 0.15.0'}
      ${'>= 0.14.0 & < 0.15.0'} | ${'update-lockfile'} | ${'v0.15.2'} | ${'>= 0.15.2 & < 0.16.0'}
      ${'^= 1.2.0'}             | ${'replace'}         | ${'v1.3.0'}  | ${'^= 1.2.0'}
      ${'^= 1.2.0'}             | ${'bump'}            | ${'v1.3.0'}  | ${'^= 1.3.0'}
      ${'^= 1.2.0'}             | ${'replace'}         | ${'v2.1.0'}  | ${'^= 2.1.0'}
      ${'^= 1.2'}               | ${'replace'}         | ${'v2.1.3'}  | ${'^= 2.1'}
      ${'^= 1.2.0'}             | ${'widen'}           | ${'v2.1.0'}  | ${'>= 1.2.0 & < 3.0.0'}
      ${'~= 1.2.0'}             | ${'replace'}         | ${'v1.3.1'}  | ${'~= 1.3.1'}
      ${'~= 1.2.0'}             | ${'widen'}           | ${'v1.3.1'}  | ${'>= 1.2.0 & < 1.4.0'}
      ${'<= 1.2.0'}             | ${'replace'}         | ${'v1.3.0'}  | ${'<= 1.3.0'}
      ${'<= 1.2'}               | ${'replace'}         | ${'v1.3.4'}  | ${'<= 1.3'}
      ${'<= 1.5.0'}             | ${'bump'}            | ${'v1.3.0'}  | ${'<= 1.5.0'}
      ${'< 2'}                  | ${'replace'}         | ${'v2.1.0'}  | ${'< 3'}
      ${'< 1.5'}                | ${'replace'}         | ${'v1.6.2'}  | ${'< 1.7'}
      ${'< 2.0.0'}              | ${'replace'}         | ${'v2.1.0'}  | ${'< 3.0.0'}
      ${'< 1.2.3'}              | ${'replace'}         | ${'v1.2.5'}  | ${'< 1.2.6'}
      ${'< 2.0.0'}              | ${'bump'}            | ${'v1.5.0'}  | ${'< 2.0.0'}
      ${'< 2.0.0 & >= 1.0.0'}   | ${'widen'}           | ${'v2.5.0'}  | ${'< 3.0.0 & >= 1.0.0'}
      ${'>= 1.0.0 & < 2.0.0'}   | ${'widen'}           | ${'v1.5.0'}  | ${'>= 1.0.0 & < 2.0.0'}
    `(
      'getNewValue("$currentValue", "$rangeStrategy", "$newVersion") === "$expected"',
      ({ currentValue, rangeStrategy, newVersion, expected }) => {
        expect(
          nimble.getNewValue({
            currentValue,
            rangeStrategy,
            currentVersion: '0.14.0',
            newVersion,
          }),
        ).toBe(expected);
      },
    );
  });

  describe('subset, intersects, isBreaking', () => {
    it('evaluates subset and intersects', () => {
      expect(
        nimble.subset!('>= 1.2.0 & < 1.5.0', '>= 1.0.0 & < 2.0.0'),
      ).toBeTrue();
      expect(
        nimble.subset!('>= 1.0.0 & < 2.0.0', '>= 1.2.0 & < 1.5.0'),
      ).toBeFalse();
      expect(nimble.subset!('#head', '>= 1.0.0')).toBeFalse();

      expect(
        nimble.intersects!('>= 1.0.0 & < 2.0.0', '>= 1.5.0 & < 3.0.0'),
      ).toBeTrue();
      expect(
        nimble.intersects!('>= 1.0.0 & < 2.0.0', '>= 2.0.0 & < 3.0.0'),
      ).toBeFalse();
      expect(nimble.intersects!('#head', '>= 1.0.0')).toBeFalse();
    });

    it('evaluates isBreaking', () => {
      expect(nimble.isBreaking!('v0.14.0', 'v0.14.1')).toBeTrue();
      expect(nimble.isBreaking!('v1.2.0', 'v1.3.0')).toBeFalse();
      expect(nimble.isBreaking!('v1.2.0', 'v2.0.0')).toBeTrue();
      expect(nimble.isBreaking!('invalid', 'v1.0.0')).toBeFalse();
      expect(
        nimble.getNewValue({
          currentValue: '^= 1.0',
          rangeStrategy: 'replace',
          newVersion: '2.0.0-alpha.1',
        }),
      ).toBe('^= 2.0.0-alpha.1');
      expect(
        nimble.getNewValue({
          currentValue: '^=1.2.3',
          rangeStrategy: 'widen',
          newVersion: '2.0.0',
        }),
      ).toBe('>=1.2.3 & <3.0.0');
    });
  });
});
