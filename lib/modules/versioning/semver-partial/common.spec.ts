import semver from 'semver';
import {
  createPartialSemverOps,
  massageValue,
  parsePartialRange,
} from './common.ts';

// the minimal configuration: no floating tags, no aliases, no tie-breaks
const ops = createPartialSemverOps({
  parseVersion: (input) => semver.parse(massageValue(input)),
  parseRange: parsePartialRange,
});

describe('modules/versioning/semver-partial/common', () => {
  describe('massageValue()', () => {
    it.each`
      input         | expected
      ${'1.2.3'}    | ${'1.2.3'}
      ${'v1.2.3'}   | ${'1.2.3'}
      ${'V1.2.3'}   | ${'1.2.3'}
      ${'  v1.2.3'} | ${'1.2.3'}
      ${'~latest'}  | ${'~latest'}
      ${'valuable'} | ${'aluable'}
    `('massageValue("$input") === "$expected"', ({ input, expected }) => {
      expect(massageValue(input)).toBe(expected);
    });
  });

  describe('parsePartialRange()', () => {
    it.each`
      input        | expected
      ${'1'}       | ${{ major: 1 }}
      ${'v1'}      | ${{ major: 1 }}
      ${'1.2'}     | ${{ major: 1, minor: 2 }}
      ${'v1.2'}    | ${{ major: 1, minor: 2 }}
      ${'1.2.3'}   | ${{ major: 1, minor: 2 }}
      ${'invalid'} | ${null}
      ${''}        | ${null}
    `('parsePartialRange("$input")', ({ input, expected }) => {
      expect(parsePartialRange(input)).toEqual(expected);
    });
  });

  describe('createPartialSemverOps()', () => {
    it('has no aliases without matchesAlias', () => {
      expect(ops.matches('1.2.3', '~latest')).toBe(false);
      expect(ops.matches('1.2.3', '1.2')).toBe(true);
    });

    it('does not tie-break without compareEqual', () => {
      expect(ops.sortVersions('v1.2.3', '1.2.3')).toBe(0);
    });

    it('compares versions with the parseVersion parser', () => {
      expect(ops.isGreaterThan('1.2.3', '1.2.2')).toBe(true);
      expect(ops.isGreaterThan('1.2', '1.1')).toBe(false);
      expect(ops.getMajor('1.2.3')).toBe(1);
      expect(ops.getMajor('1.2')).toBeNull();
    });
  });
});
