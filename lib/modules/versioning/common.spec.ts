import { partial } from '~test/util.ts';
import { intersectsWith, isSubsetOf } from './common.ts';
import { api as npm } from './npm/index.ts';
import type { VersioningApi } from './types.ts';

const noRangeSupport = partial<VersioningApi>({ isValid: () => true });

describe('modules/versioning/common', () => {
  describe('isSubsetOf()', () => {
    it.each`
      constraint     | expected
      ${'11.10.0'}   | ${true}
      ${'^11.10.0'}  | ${true}
      ${'^11.0.0'}   | ${false}
      ${'not-valid'} | ${false}
      ${''}          | ${false}
      ${null}        | ${false}
      ${undefined}   | ${false}
    `('returns $expected for $constraint', ({ constraint, expected }) => {
      expect(isSubsetOf(npm, constraint, '>=11.10.0')).toBe(expected);
    });

    it('returns false if the versioning does not support subset', () => {
      expect(isSubsetOf(noRangeSupport, '1.0.0', '>=1.0.0')).toBeFalse();
    });
  });

  describe('intersectsWith()', () => {
    it.each`
      constraint     | expected
      ${'^11.0.0'}   | ${true}
      ${'10.0.0'}    | ${false}
      ${'not-valid'} | ${false}
      ${null}        | ${false}
    `('returns $expected for $constraint', ({ constraint, expected }) => {
      expect(intersectsWith(npm, constraint, '>=11.0.0')).toBe(expected);
    });

    it('returns false if the versioning does not support intersects', () => {
      expect(intersectsWith(noRangeSupport, '1.0.0', '>=1.0.0')).toBeFalse();
    });
  });
});
