import pvp from '.';

describe('modules/versioning/pvp/index', () => {
  describe('.isGreaterThan(version, other)', () => {
    it.each`
      first       | second     | expected
      ${'1.23.1'} | ${'1.9.6'} | ${true}
      ${'4.0.0'}  | ${'3.0.0'} | ${true}
      ${'3.0.1'}  | ${'3.0.0'} | ${true}
      ${'4.10'}   | ${'4.1'}   | ${true}
      ${'1.0.0'}  | ${'1.0'}   | ${true}
      ${'2.0.2'}  | ${'3.1.0'} | ${false}
      ${'3.0.0'}  | ${'3.0.0'} | ${false}
      ${'4.1'}    | ${'4.10'}  | ${false}
      ${'1.0'}    | ${'1.0.0'} | ${false}
      ${''}       | ${'1.0'}   | ${false}
      ${'1.0'}    | ${''}      | ${false}
    `('pvp.isGreaterThan($first, $second)', ({ first, second, expected }) => {
      expect(pvp.isGreaterThan(first, second)).toBe(expected);
    });
  });

  describe('.getMajor(version)', () => {
    it.each`
      version    | expected
      ${'1.0.0'} | ${1.0}
      ${'1.0.1'} | ${1.0}
      ${'1.1.1'} | ${1.1}
      ${''}      | ${null}
    `('pvp.getMajor("$version") === $expected', ({ version, expected }) => {
      expect(pvp.getMajor(version)).toBe(expected);
    });
  });

  describe('.getMinor(version)', () => {
    it.each`
      version    | expected
      ${'1.0'}   | ${null}
      ${'1.0.0'} | ${0}
      ${'1.0.1'} | ${1}
      ${'1.1.2'} | ${2}
    `('pvp.getMinor("$version") === $expected', ({ version, expected }) => {
      expect(pvp.getMinor(version)).toBe(expected);
    });
  });

  describe('.getPatch(version)', () => {
    it.each`
      version         | expected
      ${'1.0.0'}      | ${null}
      ${'1.0.0.5.1'}  | ${5.1}
      ${'1.0.1.6'}    | ${6}
      ${'1.1.2.7'}    | ${7}
      ${'0.0.0.0.1'}  | ${0.1}
      ${'0.0.0.0.10'} | ${0.1}
    `('pvp.getPatch("$version") === $expected', ({ version, expected }) => {
      expect(pvp.getPatch(version)).toBe(expected);
    });
  });

  describe('.matches(version, range)', () => {
    it.each`
      version    | range                 | expected
      ${'1.0.1'} | ${'>=1.0 && <1.1'}    | ${true}
      ${'4.1'}   | ${'>=4.0 && <4.10'}   | ${true}
      ${'4.1'}   | ${'>=4.1 && <4.10'}   | ${true}
      ${'4.1.0'} | ${'>=4.1 && <4.10'}   | ${true}
      ${'4.1.0'} | ${'<4.10 && >=4.1'}   | ${true}
      ${'4.10'}  | ${'>=4.1 && <4.10.0'} | ${true}
      ${'4.10'}  | ${'>=4.0 && <4.10.1'} | ${true}
      ${'1.0.0'} | ${'>=2.0 && <2.1'}    | ${false}
      ${'4'}     | ${'>=4.0 && <4.10'}   | ${false}
      ${'4.10'}  | ${'>=4.1 && <4.10'}   | ${false}
      ${'4'}     | ${'gibberish'}        | ${false}
      ${''}      | ${'>=1.0 && <1.1'}    | ${false}
    `(
      'pvp.matches("$version", "$range") === $expected',
      ({ version, range, expected }) => {
        expect(pvp.matches(version, range)).toBe(expected);
      },
    );
  });

  describe('.getSatisfyingVersion(versions, range)', () => {
    it.each`
      versions                                | range              | expected
      ${['1.0.0', '1.0.4', '1.3.0', '2.0.0']} | ${'>=1.0 && <1.1'} | ${'1.0.4'}
      ${['2.0.0', '1.0.0', '1.0.4', '1.3.0']} | ${'>=1.0 && <1.1'} | ${'1.0.4'}
      ${['1.0.0', '1.0.4', '1.3.0', '2.0.0']} | ${'>=3.0 && <4.0'} | ${null}
    `(
      'pvp.getSatisfyingVersion($versions, "$range") === $expected',
      ({ versions, range, expected }) => {
        expect(pvp.getSatisfyingVersion(versions, range)).toBe(expected);
      },
    );
  });

  describe('.minSatisfyingVersion(versions, range)', () => {
    it('should return min satisfying version in range', () => {
      expect(
        pvp.minSatisfyingVersion(
          ['0.9', '1.0.0', '1.0.4', '1.3.0', '2.0.0'],
          '>=1.0 && <1.1',
        ),
      ).toBe('1.0.0');
    });
  });

  describe('.isLessThanRange(version, range)', () => {
    it.each`
      version    | range              | expected
      ${'2.0.2'} | ${'>=3.0 && <3.1'} | ${true}
      ${'3'}     | ${'>=3.0 && <3.1'} | ${true}
      ${'3'}     | ${'>=3 && <3.1'}   | ${false}
      ${'3.0'}   | ${'>=3.0 && <3.1'} | ${false}
      ${'3.0.0'} | ${'>=3.0 && <3.1'} | ${false}
      ${'4.0.0'} | ${'>=3.0 && <3.1'} | ${false}
      ${'3.1.0'} | ${'>=3.0 && <3.1'} | ${false}
      ${'3'}     | ${'gibberish'}     | ${false}
      ${''}      | ${'>=3.0 && <3.1'} | ${false}
    `(
      'pvp.isLessThanRange?.("$version", "$range") === $expected',
      ({ version, range, expected }) => {
        expect(pvp.isLessThanRange?.(version, range)).toBe(expected);
      },
    );
  });

  describe('.isValid(version)', () => {
    it.each`
      version            | expected
      ${''}              | ${false}
      ${'1.0.0.0'}       | ${true}
      ${'1.0'}           | ${true}
      ${'>=1.0 && <1.1'} | ${true}
    `('pvp.isValid("$version") === $expected', ({ version, expected }) => {
      expect(pvp.isValid(version)).toBe(expected);
    });
  });

  describe('.getNewValue(newValueConfig)', () => {
    it.each`
      currentValue       | newVersion | rangeStrategy        | expected
      ${'>=1.0 && <1.1'} | ${'1.1'}   | ${'widen'}           | ${'>=1.0 && <1.2'}
      ${'>=1.2 && <1.3'} | ${'1.2.3'} | ${'widen'}           | ${null}
      ${'>=1.0 && <1.1'} | ${'1.2.3'} | ${'update-lockfile'} | ${null}
      ${'gibberish'}     | ${'1.2.3'} | ${'widen'}           | ${null}
      ${'>=1.0 && <1.1'} | ${'0.9'}   | ${'widen'}           | ${null}
      ${'>=1.0 && <1.1'} | ${''}      | ${'widen'}           | ${null}
    `(
      'pvp.getNewValue({currentValue: "$currentValue", newVersion: "$newVersion", rangeStrategy: "$rangeStrategy"}) === $expected',
      ({ currentValue, newVersion, rangeStrategy, expected }) => {
        expect(
          pvp.getNewValue({ currentValue, newVersion, rangeStrategy }),
        ).toBe(expected);
      },
    );
  });

  describe('.isSame(...)', () => {
    it.each`
      type       | a              | b               | expected
      ${'major'} | ${'4.10'}      | ${'4.1'}        | ${false}
      ${'major'} | ${'4.1.0'}     | ${'5.1.0'}      | ${false}
      ${'major'} | ${'4.1'}       | ${'5.1'}        | ${false}
      ${'major'} | ${'0'}         | ${'1'}          | ${false}
      ${'major'} | ${'4.1'}       | ${'4.1.0'}      | ${true}
      ${'major'} | ${'4.1.1'}     | ${'4.1.2'}      | ${true}
      ${'major'} | ${'0'}         | ${'0'}          | ${true}
      ${'minor'} | ${'4.1.0'}     | ${'5.1.0'}      | ${true}
      ${'minor'} | ${'4.1'}       | ${'4.1'}        | ${true}
      ${'minor'} | ${'4.1'}       | ${'5.1'}        | ${true}
      ${'minor'} | ${'4.1.0'}     | ${'4.1.1'}      | ${false}
      ${'minor'} | ${''}          | ${'0'}          | ${false}
      ${'patch'} | ${'1.0.0.0'}   | ${'1.0.0.0'}    | ${true}
      ${'patch'} | ${'1.0.0.0'}   | ${'2.0.0.0'}    | ${true}
      ${'patch'} | ${'1.0.0.0'}   | ${'1.0.0.1'}    | ${false}
      ${'patch'} | ${'0.0.0.0.1'} | ${'0.0.0.0.10'} | ${false}
    `(
      'pvp.isSame("$type", "$a", "$b") === $expected',
      ({ type, a, b, expected }) => {
        expect(pvp.isSame?.(type, a, b)).toBe(expected);
      },
    );
  });

  describe('.isVersion(maybeRange)', () => {
    it.each`
      version            | expected
      ${'1.0'}           | ${true}
      ${'>=1.0 && <1.1'} | ${false}
    `('pvp.isVersion("$version") === $expected', ({ version, expected }) => {
      expect(pvp.isVersion(version)).toBe(expected);
    });
  });

  describe('.equals(a, b)', () => {
    it.each`
      a         | b        | expected
      ${'1.01'} | ${'1.1'} | ${true}
      ${'1.01'} | ${'1.0'} | ${false}
      ${''}     | ${'1.0'} | ${false}
      ${'1.0'}  | ${''}    | ${false}
    `('pvp.equals("$a", "$b") === $expected', ({ a, b, expected }) => {
      expect(pvp.equals(a, b)).toBe(expected);
    });
  });

  describe('.isSingleVersion(range)', () => {
    it.each`
      version            | expected
      ${'==1.0'}         | ${true}
      ${'>=1.0 && <1.1'} | ${false}
    `(
      'pvp.isSingleVersion("$version") === $expected',
      ({ version, expected }) => {
        expect(pvp.isSingleVersion(version)).toBe(expected);
      },
    );
  });

  describe('.subset(subRange, superRange)', () => {
    it.each`
      subRange           | superRange         | expected
      ${'>=1.0 && <1.1'} | ${'>=1.0 && <2.0'} | ${true}
      ${'>=1.0 && <2.0'} | ${'>=1.0 && <2.0'} | ${true}
      ${'>=1.0 && <2.1'} | ${'>=1.0 && <2.0'} | ${false}
      ${'>=0.9 && <2.1'} | ${'>=1.0 && <2.0'} | ${false}
      ${'gibberish'}     | ${''}              | ${undefined}
      ${'>=. && <.'}     | ${'>=. && <.'}     | ${undefined}
    `(
      'pvp.subbet("$subRange", "$superRange") === $expected',
      ({ subRange, superRange, expected }) => {
        expect(pvp.subset?.(subRange, superRange)).toBe(expected);
      },
    );
  });

  describe('.sortVersions()', () => {
    it.each`
      a        | b        | expected
      ${'1.0'} | ${'1.1'} | ${-1}
      ${'1.1'} | ${'1.0'} | ${1}
      ${'1.0'} | ${'1.0'} | ${0}
    `('pvp.sortVersions("$a", "$b") === $expected', ({ a, b, expected }) => {
      expect(pvp.sortVersions(a, b)).toBe(expected);
    });
  });

  describe('.isStable()', () => {
    it('should consider 0.0.0 stable', () => {
      // in PVP, stability is not conveyed in the version number
      // so we consider all versions stable
      expect(pvp.isStable('0.0.0')).toBeTrue();
    });
  });

  describe('.isCompatible()', () => {
    it('should consider 0.0.0 compatible', () => {
      // in PVP, there is no extra information besides the numbers
      // so we consider all versions compatible
      expect(pvp.isCompatible('0.0.0')).toBeTrue();
    });
  });
});
