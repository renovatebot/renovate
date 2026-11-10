import exact from './index.ts';

describe('modules/versioning/exact/index', () => {
  describe('isValid', () => {
    it.each`
      input              | expected
      ${''}              | ${false}
      ${'v1'}            | ${true}
      ${'1.0.0'}         | ${true}
      ${'any-string'}    | ${true}
      ${'abc123'}        | ${true}
      ${'sha256:abcdef'} | ${true}
    `('isValid("$input") === $expected', ({ input, expected }) => {
      expect(exact.isValid(input)).toBe(expected);
    });
  });

  describe('isVersion', () => {
    it.each`
      input        | expected
      ${null}      | ${false}
      ${undefined} | ${false}
      ${''}        | ${false}
      ${'v1'}      | ${true}
      ${'1.0.0'}   | ${true}
    `('isVersion($input) === $expected', ({ input, expected }) => {
      expect(exact.isVersion(input)).toBe(expected);
    });
  });

  describe('isSingleVersion', () => {
    it('returns true for any valid version', () => {
      expect(exact.isSingleVersion('1.0.0')).toBe(true);
      expect(exact.isSingleVersion('any-string')).toBe(true);
    });
  });

  describe('isStable', () => {
    it('returns true for any version', () => {
      expect(exact.isStable('1.0.0-alpha')).toBe(true);
      expect(exact.isStable('1.0.0')).toBe(true);
    });
  });

  describe('isCompatible', () => {
    it('returns true when version equals current', () => {
      expect(exact.isCompatible('v1', 'v1')).toBe(true);
    });

    it('returns false when version differs from current', () => {
      expect(exact.isCompatible('v1.0.0', 'v1.1.0')).toBe(false);
    });
  });

  describe('getMajor/getMinor/getPatch', () => {
    it('returns null for all', () => {
      expect(exact.getMajor('1.2.3')).toBeNull();
      expect(exact.getMinor('1.2.3')).toBeNull();
      expect(exact.getPatch('1.2.3')).toBeNull();
    });
  });

  describe('equals', () => {
    it.each`
      a          | b          | expected
      ${'1.0.0'} | ${'1.0.0'} | ${true}
      ${'v1'}    | ${'v1'}    | ${true}
      ${'1.0.0'} | ${'1.0'}   | ${false}
      ${'v1'}    | ${'v2'}    | ${false}
    `('equals("$a", "$b") === $expected', ({ a, b, expected }) => {
      expect(exact.equals(a, b)).toBe(expected);
    });
  });

  describe('isGreaterThan', () => {
    it.each`
      a        | b        | expected
      ${'2.0'} | ${'1.0'} | ${false}
      ${'1.0'} | ${'2.0'} | ${false}
      ${'a'}   | ${'b'}   | ${false}
    `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
      expect(exact.isGreaterThan(a, b)).toBe(expected);
    });
  });

  describe('matches', () => {
    it.each`
      version    | range      | expected
      ${'1.0.0'} | ${'1.0.0'} | ${true}
      ${'1.0.0'} | ${'1.0'}   | ${false}
      ${'v1'}    | ${'v1'}    | ${true}
      ${'v1'}    | ${'v2'}    | ${false}
    `(
      'matches("$version", "$range") === $expected',
      ({ version, range, expected }) => {
        expect(exact.matches(version, range)).toBe(expected);
      },
    );
  });

  describe('getSatisfyingVersion', () => {
    it('returns exact match only', () => {
      const versions = ['1.0.0', '1.0.1', '2.0.0'];
      expect(exact.getSatisfyingVersion(versions, '1.0.0')).toBe('1.0.0');
      expect(exact.getSatisfyingVersion(versions, '1.0.2')).toBeNull();
    });
  });

  describe('minSatisfyingVersion', () => {
    it('returns exact match only', () => {
      const versions = ['1.0.0', '1.0.1', '2.0.0'];
      expect(exact.minSatisfyingVersion(versions, '1.0.1')).toBe('1.0.1');
      expect(exact.minSatisfyingVersion(versions, '3.0.0')).toBeNull();
    });
  });

  describe('getNewValue', () => {
    it('returns currentValue unchanged', () => {
      expect(
        exact.getNewValue({
          currentValue: 'v1',
          rangeStrategy: 'auto',
          currentVersion: 'v1',
          newVersion: 'v2',
        }),
      ).toBe('v1');
    });
  });

  describe('sortVersions', () => {
    it('returns 0 for any comparison', () => {
      expect(exact.sortVersions('1.0', '2.0')).toBe(0);
      expect(exact.sortVersions('a', 'b')).toBe(0);
    });
  });
});
