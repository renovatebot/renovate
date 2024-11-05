import pvp, { extractAllComponents, getComponents, parse } from '.';

describe('modules/versioning/pvp/index', () => {
  describe('.isGreaterThan(version, other)', () => {
    it('should return true', () => {
      expect(pvp.isGreaterThan('1.23.1', '1.9.6')).toBeTrue();
      expect(pvp.isGreaterThan('4.0.0', '3.0.0')).toBeTrue();
      expect(pvp.isGreaterThan('3.0.1', '3.0.0')).toBeTrue();
      expect(pvp.isGreaterThan('4.10', '4.1')).toBeTrue();
      expect(pvp.isGreaterThan('1.0.0', '1.0')).toBeTrue();
    });

    it('should return false', () => {
      expect(pvp.isGreaterThan('2.0.2', '3.1.0')).toBeFalse(); // less
      expect(pvp.isGreaterThan('3.0.0', '3.0.0')).toBeFalse(); // equal
      expect(pvp.isGreaterThan('4.1', '4.10')).toBeFalse();
      expect(pvp.isGreaterThan('1.0', '1.0.0')).toBeFalse();
    });
  });

  describe('.parse(range)', () => {
    it('should parse >=1.0 && <1.1', () => {
      const parsed = parse('>=1.0 && <1.1');
      expect(parsed).not.toBeNull();
      expect(parsed!.lower).toBe('1.0');
      expect(parsed!.upper).toBe('1.1');
    });
  });

  describe('.getMajor(version)', () => {
    it('should extract second component as decimal digit', () => {
      expect(pvp.getMajor('1.0.0')).toBe(1.0);
      expect(pvp.getMajor('1.0.1')).toBe(1.0);
      expect(pvp.getMajor('1.1.1')).toBe(1.1);
    });
  });

  describe('.getMinor(version)', () => {
    it('should extract minor as third component in version', () => {
      expect(pvp.getMinor('1.0')).toBeNull();
      expect(pvp.getMinor('1.0.0')).toBe(0);
      expect(pvp.getMinor('1.0.1')).toBe(1);
      expect(pvp.getMinor('1.1.2')).toBe(2);
    });
  });

  describe('.getPatch(version)', () => {
    it('should return null where there is no patch version', () => {
      expect(pvp.getPatch('1.0.0')).toBeNull();
    });

    it('should extract all remaining components as decimal digits', () => {
      expect(pvp.getPatch('1.0.0.5.1')).toBe(5.1);
      expect(pvp.getPatch('1.0.1.6')).toBe(6);
      expect(pvp.getPatch('1.1.2.7')).toBe(7);
    });
  });

  describe('.matches(version, range)', () => {
    it('should return true when version has same major', () => {
      expect(pvp.matches('1.0.1', '>=1.0 && <1.1')).toBeTrue();
      expect(pvp.matches('4.1', '>=4.0 && <4.10')).toBeTrue();
      expect(pvp.matches('4.1', '>=4.1 && <4.10')).toBeTrue();
      expect(pvp.matches('4.1.0', '>=4.1 && <4.10')).toBeTrue();
      expect(pvp.matches('4.10', '>=4.1 && <4.10.0')).toBeTrue();
      expect(pvp.matches('4.10', '>=4.0 && <4.10.1')).toBeTrue();
    });

    it('should return false when version has different major', () => {
      expect(pvp.matches('1.0.0', '>=2.0 && <2.1')).toBeFalse();
      expect(pvp.matches('4', '>=4.0 && <4.10')).toBeFalse();
      expect(pvp.matches('4.10', '>=4.1 && <4.10')).toBeFalse();
    });

    it("should return false when range can't be parsed", () => {
      expect(pvp.matches('4', 'gibberish')).toBeFalse();
    });
  });

  describe('.getSatisfyingVersion(versions, range)', () => {
    it('should return max satisfying version in range', () => {
      expect(
        pvp.getSatisfyingVersion(
          ['1.0.0', '1.0.4', '1.3.0', '2.0.0'],
          '>=1.0 && <1.1',
        ),
      ).toBe('1.0.4');
    });
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
    it('should return true', () => {
      expect(pvp.isLessThanRange?.('2.0.2', '>=3.0 && <3.1')).toBeTrue();
      expect(pvp.isLessThanRange?.('3', '>=3.0 && <3.1')).toBeTrue();
    });

    it('should return false', () => {
      expect(pvp.isLessThanRange?.('3', '>=3 && <3.1')).toBeFalse();
      expect(pvp.isLessThanRange?.('3.0', '>=3.0 && <3.1')).toBeFalse();
      expect(pvp.isLessThanRange?.('3.0.0', '>=3.0 && <3.1')).toBeFalse();
      expect(pvp.isLessThanRange?.('4.0.0', '>=3.0 && <3.1')).toBeFalse();
      expect(pvp.isLessThanRange?.('3.1.0', '>=3.0 && <3.1')).toBeFalse();
    });

    it("should return false when range can't be parsed", () => {
      expect(pvp.isLessThanRange?.('3', 'gibberish')).toBeFalse();
    });
  });

  describe('.extractAllComponents(version)', () => {
    it('should return an empty array when there are no numbers', () => {
      expect(extractAllComponents('')).toEqual([]);
    });

    it('should parse 3.0', () => {
      expect(extractAllComponents('3.0')).toEqual([3, 0]);
    });
  });

  describe('.isValid(version)', () => {
    it('should reject zero components', () => {
      expect(pvp.isValid('')).toBeFalse();
    });

    it('should accept four components', () => {
      expect(pvp.isValid('1.0.0.0')).toBeTrue();
    });

    it('should accept 1.0 as valid', () => {
      expect(pvp.isValid('1.0')).toBeTrue();
    });

    it('should accept >=1.0 && <1.1 as valid (range)', () => {
      expect(pvp.isValid('>=1.0 && <1.1')).toBeTrue();
    });
  });

  describe('.getNewValue(newValueConfig)', () => {
    it('should bump the upper end of the range if necessary', () => {
      expect(
        pvp.getNewValue({
          currentValue: '>=1.0 && <1.1',
          newVersion: '1.1',
          rangeStrategy: 'auto',
        }),
      ).toBe('>=1.0 && <1.2');
    });

    it("shouldn't modify the range if not necessary", () => {
      expect(
        pvp.getNewValue({
          currentValue: '>=1.2 && <1.3',
          newVersion: '1.2.3',
          rangeStrategy: 'auto',
        }),
      ).toBeNull();
    });

    it('should return null when given unimplemented range strategies like update-lockfile', () => {
      expect(
        pvp.getNewValue({
          currentValue: '>=1.0 && <1.1',
          newVersion: '1.2.3',
          rangeStrategy: 'update-lockfile',
        }),
      ).toBeNull();
    });

    it("should return null when given range that can't be parsed", () => {
      expect(
        pvp.getNewValue({
          currentValue: 'gibberish',
          newVersion: '1.2.3',
          rangeStrategy: 'auto',
        }),
      ).toBeNull();
    });

    it('should return null when newVersion is below range', () => {
      expect(
        pvp.getNewValue({
          currentValue: '>=1.0 && <1.1',
          newVersion: '0.9',
          rangeStrategy: 'auto',
        }),
      ).toBeNull();
    });
  });

  describe('.getComponents(...)', () => {
    it('"0" is valid major version', () => {
      expect(getComponents('0')?.major).toEqual([0]);
    });

    it('returns null when no components could be extracted', () => {
      expect(getComponents('')).toBeNull();
    });
  });

  describe('.isSame(...)', () => {
    it('should compare major components correctly', () => {
      expect(pvp.isSame?.('major', '4.10', '4.1')).toBeFalse();
      expect(pvp.isSame?.('major', '4.1.0', '5.1.0')).toBeFalse();
      expect(pvp.isSame?.('major', '4.1', '5.1')).toBeFalse();
      expect(pvp.isSame?.('major', '0', '1')).toBeFalse();
      expect(pvp.isSame?.('major', '4.1', '4.1.0')).toBeTrue();
      expect(pvp.isSame?.('major', '4.1.1', '4.1.2')).toBeTrue();
      expect(pvp.isSame?.('major', '0', '0')).toBeTrue();
    });

    it('should compare minor components correctly', () => {
      expect(pvp.isSame?.('minor', '4.1.0', '5.1.0')).toBeTrue();
      expect(pvp.isSame?.('minor', '4.1', '4.1')).toBeTrue();
      expect(pvp.isSame?.('minor', '4.1', '5.1')).toBeTrue();
      expect(pvp.isSame?.('minor', '4.1.0', '4.1.1')).toBeFalse();
    });

    it('should return false when the given a invalid version', () => {
      expect(pvp.isSame?.('minor', '', '0')).toBeFalse();
    });
  });

  describe('.isVersion(maybeRange)', () => {
    it('should accept 1.0 as valid version', () => {
      expect(pvp.isVersion('1.0')).toBeTrue();
    });

    it('should reject >=1.0 && <1.1 as it is a range, not a version', () => {
      expect(pvp.isVersion('>=1.0 && <1.1')).toBeFalse();
    });
  });

  describe('.equals(a, b)', () => {
    it('should regard 1.01 and 1.1 as equal', () => {
      expect(pvp.equals('1.01', '1.1')).toBeTrue();
    });

    it('should regard 1.01 and 1.0 are not equal', () => {
      expect(pvp.equals('1.01', '1.0')).toBeFalse();
    });
  });

  describe('.isSingleVersion(range)', () => {
    it('should consider ==1.0 a single version', () => {
      expect(pvp.isSingleVersion('==1.0')).toBeTrue();
    });

    it('should return false for ranges', () => {
      expect(pvp.isSingleVersion('>=1.0 && <1.1')).toBeFalse();
    });
  });

  describe('.subset(subRange, superRange)', () => {
    it('1.1-1.2 is inside 1.0-2.0', () => {
      expect(pvp.subset?.('>=1.0 && <1.1', '>=1.0 && <2.0')).toBeTrue();
    });

    it('1.0-2.0 is inside 1.0-2.0', () => {
      expect(pvp.subset?.('>=1.0 && <2.0', '>=1.0 && <2.0')).toBeTrue();
    });

    it('1.0-2.1 outside 1.0-2.0', () => {
      expect(pvp.subset?.('>=1.0 && <2.1', '>=1.0 && <2.0')).toBeFalse();
    });

    it('0.9-2.0 outside 1.0-2.0', () => {
      expect(pvp.subset?.('>=0.9 && <2.1', '>=1.0 && <2.0')).toBeFalse();
    });

    it("returns undefined when passed a range that can't be parsed", () => {
      expect(pvp.subset?.('gibberish', '')).toBeUndefined();
    });
  });
});
