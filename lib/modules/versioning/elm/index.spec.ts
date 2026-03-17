import { api as elm } from './index.ts';

describe('modules/versioning/elm/index', () => {
  describe('isVersion', () => {
    it.each`
      input        | expected
      ${'1.0.0'}   | ${true}
      ${'0.19.1'}  | ${true}
      ${'2.0.0'}   | ${true}
      ${'1.2.3'}   | ${true}
      ${'invalid'} | ${false}
      ${'1.0'}     | ${false}
      ${'1'}       | ${false}
      ${''}        | ${false}
      ${null}      | ${false}
      ${undefined} | ${false}
    `('isVersion("$input") === $expected', ({ input, expected }) => {
      expect(elm.isVersion(input)).toBe(expected);
    });
  });

  describe('isValid', () => {
    it.each`
      input                     | expected
      ${'1.0.0'}                | ${true}
      ${'1.0.0 <= v < 2.0.0'}   | ${true}
      ${'0.19.0 <= v < 0.20.0'} | ${true}
      ${'1.0.0 <= v < 1.0.1'}   | ${true}
      ${'invalid'}              | ${false}
      ${'1.0.0 <= v'}           | ${false}
      ${'<= v < 2.0.0'}         | ${false}
      ${'1.0.0 < v < 2.0.0'}    | ${false}
      ${'1.0.0 <= v <= 2.0.0'}  | ${false}
      ${'>=1.0.0 <2.0.0'}       | ${false}
      ${''}                     | ${false}
      ${'2.0.0 <= v < 1.0.0'}   | ${false}
    `('isValid("$input") === $expected', ({ input, expected }) => {
      expect(elm.isValid(input)).toBe(expected);
    });
  });

  describe('isSingleVersion', () => {
    it.each`
      input                   | expected
      ${'1.0.0'}              | ${true}
      ${'0.19.1'}             | ${true}
      ${'1.0.0 <= v < 2.0.0'} | ${false}
      ${'invalid'}            | ${false}
    `('isSingleVersion("$input") === $expected', ({ input, expected }) => {
      expect(elm.isSingleVersion(input)).toBe(expected);
    });
  });

  describe('isStable', () => {
    it.each`
      input             | expected
      ${'1.0.0'}        | ${true}
      ${'2.3.4'}        | ${true}
      ${'1.0.0-alpha'}  | ${false}
      ${'1.0.0-beta.1'} | ${false}
    `('isStable("$input") === $expected', ({ input, expected }) => {
      expect(elm.isStable(input)).toBe(expected);
    });

    it('returns false for invalid version', () => {
      expect(elm.isStable('invalid')).toBe(false);
    });
  });

  describe('isCompatible', () => {
    it.each`
      input        | expected
      ${'1.0.0'}   | ${true}
      ${'invalid'} | ${false}
    `('isCompatible("$input") === $expected', ({ input, expected }) => {
      expect(elm.isCompatible(input)).toBe(expected);
    });
  });

  describe('getMajor/getMinor/getPatch', () => {
    it('extracts version components', () => {
      expect(elm.getMajor('1.2.3')).toBe(1);
      expect(elm.getMinor('1.2.3')).toBe(2);
      expect(elm.getPatch('1.2.3')).toBe(3);
    });
  });

  describe('equals', () => {
    it.each`
      a          | b          | expected
      ${'1.0.0'} | ${'1.0.0'} | ${true}
      ${'1.0.0'} | ${'1.0.1'} | ${false}
      ${'2.0.0'} | ${'1.0.0'} | ${false}
    `('equals("$a", "$b") === $expected', ({ a, b, expected }) => {
      expect(elm.equals(a, b)).toBe(expected);
    });
  });

  describe('isGreaterThan', () => {
    it.each`
      a          | b          | expected
      ${'2.0.0'} | ${'1.0.0'} | ${true}
      ${'1.0.1'} | ${'1.0.0'} | ${true}
      ${'1.0.0'} | ${'1.0.0'} | ${false}
      ${'1.0.0'} | ${'2.0.0'} | ${false}
    `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
      expect(elm.isGreaterThan(a, b)).toBe(expected);
    });
  });

  describe('sortVersions', () => {
    it('sorts versions correctly', () => {
      expect(elm.sortVersions('1.0.0', '2.0.0')).toBeLessThan(0);
      expect(elm.sortVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
      expect(elm.sortVersions('1.0.0', '1.0.0')).toBe(0);
    });
  });

  describe('matches', () => {
    it.each`
      version     | range                     | expected
      ${'1.0.0'}  | ${'1.0.0'}                | ${true}
      ${'1.0.1'}  | ${'1.0.0'}                | ${false}
      ${'1.0.0'}  | ${'1.0.0 <= v < 2.0.0'}   | ${true}
      ${'1.5.0'}  | ${'1.0.0 <= v < 2.0.0'}   | ${true}
      ${'1.9.9'}  | ${'1.0.0 <= v < 2.0.0'}   | ${true}
      ${'2.0.0'}  | ${'1.0.0 <= v < 2.0.0'}   | ${false}
      ${'0.9.0'}  | ${'1.0.0 <= v < 2.0.0'}   | ${false}
      ${'0.19.0'} | ${'0.19.0 <= v < 0.20.0'} | ${true}
      ${'0.19.1'} | ${'0.19.0 <= v < 0.20.0'} | ${true}
      ${'0.20.0'} | ${'0.19.0 <= v < 0.20.0'} | ${false}
    `(
      'matches("$version", "$range") === $expected',
      ({ version, range, expected }) => {
        expect(elm.matches(version, range)).toBe(expected);
      },
    );

    it('returns false for invalid version', () => {
      expect(elm.matches('invalid', '1.0.0 <= v < 2.0.0')).toBe(false);
    });

    it('returns false for invalid range', () => {
      expect(elm.matches('1.0.0', 'invalid')).toBe(false);
    });

    it('returns false for malformed range where lower > upper', () => {
      expect(elm.matches('1.5.0', '2.0.0 <= v < 1.0.0')).toBe(false);
    });
  });

  describe('isLessThanRange', () => {
    it.each`
      version    | range                   | expected
      ${'0.9.0'} | ${'1.0.0 <= v < 2.0.0'} | ${true}
      ${'0.5.0'} | ${'1.0.0 <= v < 2.0.0'} | ${true}
      ${'1.0.0'} | ${'1.0.0 <= v < 2.0.0'} | ${false}
      ${'1.5.0'} | ${'1.0.0 <= v < 2.0.0'} | ${false}
      ${'2.0.0'} | ${'1.0.0 <= v < 2.0.0'} | ${false}
      ${'0.9.0'} | ${'1.0.0'}              | ${true}
      ${'1.0.0'} | ${'1.0.0'}              | ${false}
      ${'1.1.0'} | ${'1.0.0'}              | ${false}
    `(
      'isLessThanRange("$version", "$range") === $expected',
      ({ version, range, expected }) => {
        expect(elm.isLessThanRange?.(version, range)).toBe(expected);
      },
    );

    it('returns false for invalid version', () => {
      expect(elm.isLessThanRange?.('invalid', '1.0.0 <= v < 2.0.0')).toBe(
        false,
      );
    });

    it('returns false for invalid range', () => {
      expect(elm.isLessThanRange?.('1.0.0', 'invalid')).toBe(false);
    });
  });

  describe('getSatisfyingVersion', () => {
    it.each`
      versions                       | range                   | expected
      ${['1.0.0', '1.5.0', '2.0.0']} | ${'1.0.0 <= v < 2.0.0'} | ${'1.5.0'}
      ${['1.0.0', '1.0.1', '1.0.2']} | ${'1.0.0 <= v < 2.0.0'} | ${'1.0.2'}
      ${['0.5.0', '0.9.0']}          | ${'1.0.0 <= v < 2.0.0'} | ${null}
      ${['2.0.0', '3.0.0']}          | ${'1.0.0 <= v < 2.0.0'} | ${null}
      ${['1.0.0']}                   | ${'1.0.0'}              | ${'1.0.0'}
      ${['1.0.1']}                   | ${'1.0.0'}              | ${null}
    `(
      'getSatisfyingVersion($versions, "$range") === $expected',
      ({ versions, range, expected }) => {
        expect(elm.getSatisfyingVersion(versions, range)).toBe(expected);
      },
    );
  });

  describe('minSatisfyingVersion', () => {
    it.each`
      versions                       | range                   | expected
      ${['1.0.0', '1.5.0', '2.0.0']} | ${'1.0.0 <= v < 2.0.0'} | ${'1.0.0'}
      ${['1.5.0', '1.6.0', '1.7.0']} | ${'1.0.0 <= v < 2.0.0'} | ${'1.5.0'}
      ${['0.5.0', '0.9.0']}          | ${'1.0.0 <= v < 2.0.0'} | ${null}
      ${['2.0.0', '3.0.0']}          | ${'1.0.0 <= v < 2.0.0'} | ${null}
    `(
      'minSatisfyingVersion($versions, "$range") === $expected',
      ({ versions, range, expected }) => {
        expect(elm.minSatisfyingVersion(versions, range)).toBe(expected);
      },
    );
  });

  describe('getNewValue', () => {
    describe('exact versions', () => {
      it('replaces exact version with new version', () => {
        expect(
          elm.getNewValue({
            currentValue: '1.0.0',
            rangeStrategy: 'replace',
            newVersion: '1.0.5',
          }),
        ).toBe('1.0.5');
      });

      it('handles bump strategy for exact version', () => {
        expect(
          elm.getNewValue({
            currentValue: '1.0.0',
            rangeStrategy: 'bump',
            newVersion: '2.0.0',
          }),
        ).toBe('2.0.0');
      });
    });

    describe('range constraints', () => {
      it.each`
        currentValue              | rangeStrategy        | newVersion  | expected
        ${'1.0.0 <= v < 2.0.0'}   | ${'bump'}            | ${'1.0.5'}  | ${'1.0.5 <= v < 2.0.0'}
        ${'1.0.0 <= v < 2.0.0'}   | ${'bump'}            | ${'2.0.0'}  | ${'2.0.0 <= v < 3.0.0'}
        ${'1.0.0 <= v < 2.0.0'}   | ${'widen'}           | ${'1.5.0'}  | ${'1.0.0 <= v < 2.0.0'}
        ${'1.0.0 <= v < 2.0.0'}   | ${'widen'}           | ${'2.0.0'}  | ${'1.0.0 <= v < 3.0.0'}
        ${'1.0.0 <= v < 2.0.0'}   | ${'widen'}           | ${'2.5.0'}  | ${'1.0.0 <= v < 3.0.0'}
        ${'1.0.0 <= v < 2.0.0'}   | ${'replace'}         | ${'1.5.0'}  | ${'1.5.0 <= v < 2.0.0'}
        ${'1.0.0 <= v < 2.0.0'}   | ${'replace'}         | ${'2.0.0'}  | ${'2.0.0 <= v < 3.0.0'}
        ${'0.19.0 <= v < 0.20.0'} | ${'bump'}            | ${'0.19.1'} | ${'0.19.1 <= v < 0.20.0'}
        ${'0.19.0 <= v < 0.20.0'} | ${'replace'}         | ${'0.20.0'} | ${'0.20.0 <= v < 1.0.0'}
        ${'1.0.0 <= v < 2.0.0'}   | ${'update-lockfile'} | ${'1.5.0'}  | ${'1.0.0 <= v < 2.0.0'}
        ${'1.0.0 <= v < 2.0.0'}   | ${'update-lockfile'} | ${'2.0.0'}  | ${'2.0.0 <= v < 3.0.0'}
        ${'1.0.0 <= v < 2.0.0'}   | ${'pin'}             | ${'1.5.0'}  | ${'1.5.0'}
      `(
        'getNewValue("$currentValue", "$rangeStrategy", "$newVersion") === "$expected"',
        ({ currentValue, rangeStrategy, newVersion, expected }) => {
          expect(
            elm.getNewValue({
              currentValue,
              rangeStrategy,
              currentVersion: '1.0.0',
              newVersion,
            }),
          ).toBe(expected);
        },
      );
    });

    it('returns null for invalid new version', () => {
      expect(
        elm.getNewValue({
          currentValue: '1.0.0 <= v < 2.0.0',
          rangeStrategy: 'bump',
          newVersion: 'invalid',
        }),
      ).toBeNull();
    });

    it('returns null for invalid current value', () => {
      expect(
        elm.getNewValue({
          currentValue: 'invalid',
          rangeStrategy: 'bump',
          newVersion: '1.5.0',
        }),
      ).toBeNull();
    });

    it('returns null for unknown range strategy', () => {
      expect(
        elm.getNewValue({
          currentValue: '1.0.0 <= v < 2.0.0',
          rangeStrategy: 'auto' as never,
          newVersion: '1.5.0',
        }),
      ).toBeNull();
    });

    it('handles widen when newVersion equals upper bound exactly', () => {
      expect(
        elm.getNewValue({
          currentValue: '1.0.0 <= v < 2.0.0',
          rangeStrategy: 'widen',
          newVersion: '2.0.0',
        }),
      ).toBe('1.0.0 <= v < 3.0.0');
    });

    describe('elm-version range scenarios', () => {
      it('widens elm-version range for new compiler release', () => {
        // Simulates updating elm-version in package elm.json when new Elm compiler is released
        expect(
          elm.getNewValue({
            currentValue: '0.19.0 <= v < 0.20.0',
            rangeStrategy: 'widen',
            newVersion: '0.20.0',
          }),
        ).toBe('0.19.0 <= v < 1.0.0');
      });

      it('keeps elm-version range unchanged when version is already satisfied', () => {
        expect(
          elm.getNewValue({
            currentValue: '0.19.0 <= v < 0.20.0',
            rangeStrategy: 'update-lockfile',
            newVersion: '0.19.1',
          }),
        ).toBe('0.19.0 <= v < 0.20.0');
      });

      it('replaces elm-version range when explicitly requested', () => {
        expect(
          elm.getNewValue({
            currentValue: '0.19.0 <= v < 0.20.0',
            rangeStrategy: 'replace',
            newVersion: '0.19.1',
          }),
        ).toBe('0.19.1 <= v < 1.0.0');
      });
    });
  });

  describe('getSatisfyingVersion with elm-version ranges', () => {
    it('finds highest satisfying version for elm-version range', () => {
      // Simulates GitHub tags datasource returning compiler versions
      const compilerVersions = [
        '0.18.0',
        '0.19.0',
        '0.19.1',
        '0.20.0',
        '0.21.0',
      ];
      expect(
        elm.getSatisfyingVersion(compilerVersions, '0.19.0 <= v < 0.20.0'),
      ).toBe('0.19.1');
    });

    it('returns null when no compiler version satisfies range', () => {
      const compilerVersions = ['0.18.0', '0.20.0'];
      expect(
        elm.getSatisfyingVersion(compilerVersions, '0.19.0 <= v < 0.20.0'),
      ).toBeNull();
    });
  });
});
