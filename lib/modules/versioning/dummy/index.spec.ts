import dummy from '.';

describe('modules/versioning/dummy/index', () => {
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
      expect(dummy.isValid(input)).toBe(expected);
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
      expect(dummy.isVersion(input)).toBe(expected);
    });
  });

  describe('isSingleVersion', () => {
    it('returns true for any valid version', () => {
      expect(dummy.isSingleVersion('1.0.0')).toBe(true);
      expect(dummy.isSingleVersion('any-string')).toBe(true);
    });
  });

  describe('isStable', () => {
    it('returns true for any version', () => {
      expect(dummy.isStable('1.0.0-alpha')).toBe(true);
      expect(dummy.isStable('1.0.0')).toBe(true);
    });
  });

  describe('isCompatible', () => {
    it('returns true for any valid version', () => {
      expect(dummy.isCompatible('v1', 'v2')).toBe(true);
    });
  });

  describe('getMajor/getMinor/getPatch', () => {
    it('returns null for all', () => {
      expect(dummy.getMajor('1.2.3')).toBeNull();
      expect(dummy.getMinor('1.2.3')).toBeNull();
      expect(dummy.getPatch('1.2.3')).toBeNull();
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
      expect(dummy.equals(a, b)).toBe(expected);
    });
  });

  describe('isGreaterThan', () => {
    it.each`
      a        | b        | expected
      ${'2.0'} | ${'1.0'} | ${false}
      ${'1.0'} | ${'2.0'} | ${false}
      ${'a'}   | ${'b'}   | ${false}
    `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
      expect(dummy.isGreaterThan(a, b)).toBe(expected);
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
        expect(dummy.matches(version, range)).toBe(expected);
      },
    );
  });

  describe('getSatisfyingVersion', () => {
    it('returns exact match only', () => {
      const versions = ['1.0.0', '1.0.1', '2.0.0'];
      expect(dummy.getSatisfyingVersion(versions, '1.0.0')).toBe('1.0.0');
      expect(dummy.getSatisfyingVersion(versions, '1.0.2')).toBeNull();
    });
  });

  describe('minSatisfyingVersion', () => {
    it('returns exact match only', () => {
      const versions = ['1.0.0', '1.0.1', '2.0.0'];
      expect(dummy.minSatisfyingVersion(versions, '1.0.1')).toBe('1.0.1');
      expect(dummy.minSatisfyingVersion(versions, '3.0.0')).toBeNull();
    });
  });

  describe('getNewValue', () => {
    it('returns currentValue unchanged', () => {
      expect(
        dummy.getNewValue({
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
      expect(dummy.sortVersions('1.0', '2.0')).toBe(0);
      expect(dummy.sortVersions('a', 'b')).toBe(0);
    });
  });
});
