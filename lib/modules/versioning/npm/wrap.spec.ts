import { wrapNpmRanges } from './wrap.ts';

// `caret1.2.3` is not a valid npm range and `x1.2.3` is not a valid npm
// version, so the assertions below fail unless the conversion was applied.
function toNpmRange(range: string): string {
  return range.replace('caret', '^');
}

function toNpmVersion(version: string): string {
  return version.replace('x', '');
}

describe('modules/versioning/npm/wrap', () => {
  describe('without a version converter', () => {
    const api = wrapNpmRanges({ id: 'test', toNpmRange });

    it('converts the range for isValid', () => {
      expect(api.isValid('caret1.2.3')).toBe(true);
      expect(api.isValid('not a range')).toBe(false);
    });

    it('converts the range but not the version for matches', () => {
      expect(api.matches('1.2.4', 'caret1.2.3')).toBe(true);
      expect(api.matches('2.0.0', 'caret1.2.3')).toBe(false);
      expect(api.matches('x1.2.4', 'caret1.2.3')).toBe(false);
    });

    it('converts the range but not the versions for getSatisfyingVersion', () => {
      expect(
        api.getSatisfyingVersion(['1.2.3', '1.2.4', '2.0.0'], 'caret1.2.3'),
      ).toBe('1.2.4');
      expect(api.getSatisfyingVersion(['x1.2.4'], 'caret1.2.3')).toBeNull();
    });

    it('converts the range but not the versions for minSatisfyingVersion', () => {
      expect(
        api.minSatisfyingVersion(['1.2.3', '1.2.4', '2.0.0'], 'caret1.2.3'),
      ).toBe('1.2.3');
      expect(api.minSatisfyingVersion(['x1.2.4'], 'caret1.2.3')).toBeNull();
    });

    it('converts the range for isLessThanRange', () => {
      expect(api.isLessThanRange('1.0.0', 'caret1.2.3')).toBe(true);
      expect(api.isLessThanRange('1.2.4', 'caret1.2.3')).toBe(false);
    });
  });

  describe('with a version converter', () => {
    const api = wrapNpmRanges({ id: 'test', toNpmRange, toNpmVersion });

    it('converts the version for matches', () => {
      expect(api.matches('x1.2.4', 'caret1.2.3')).toBe(true);
    });

    it('converts the versions for getSatisfyingVersion', () => {
      expect(api.getSatisfyingVersion(['x1.2.3', 'x1.2.4'], 'caret1.2.3')).toBe(
        '1.2.4',
      );
    });

    it('converts the versions for minSatisfyingVersion', () => {
      expect(api.minSatisfyingVersion(['x1.2.3', 'x1.2.4'], 'caret1.2.3')).toBe(
        '1.2.3',
      );
    });

    it('converts the version for isLessThanRange', () => {
      expect(api.isLessThanRange('x1.0.0', 'caret1.2.3')).toBe(true);
    });
  });

  describe('onRangeError', () => {
    it('rethrows by default', () => {
      const api = wrapNpmRanges({ id: 'test', toNpmRange });

      expect(api.subset('caret1.2.3', 'caret1.0.0')).toBe(true);
      expect(api.subset('caret1.2.3', 'caret2.0.0')).toBe(false);
      expect(api.intersects('caret1.2.3', 'caret1.0.0')).toBe(true);
      expect(api.intersects('caret1.2.3', 'caret2.0.0')).toBe(false);

      expect(() => api.subset('not a range', 'caret1.0.0')).toThrow(
        'Invalid comparator: not',
      );
      expect(() => api.intersects('not a range', 'caret1.0.0')).toThrow(
        'Invalid comparator: not',
      );
    });

    it('returns false when configured to', () => {
      const api = wrapNpmRanges({
        id: 'test',
        toNpmRange,
        onRangeError: 'false',
      });

      expect(api.subset('caret1.2.3', 'caret1.0.0')).toBe(true);
      expect(api.intersects('caret1.2.3', 'caret1.0.0')).toBe(true);

      expect(api.subset('not a range', 'caret1.0.0')).toBe(false);
      expect(api.intersects('not a range', 'caret1.0.0')).toBe(false);
    });
  });
});
