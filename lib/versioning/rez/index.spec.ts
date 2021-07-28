import { getName } from '../../../test/util';
import type { RangeStrategy } from '../../types';
import { api as versioning } from '.';

describe(getName(), () => {
  describe('equals', () => {
    it.each([
      ['1', '1'],
      ['1.0', '1'],
      ['1.0.0', '1'],
      ['1.9.0', '1.9'],
    ])('%s == %s', (a, b) => {
      expect(versioning.equals(a, b)).toBe(true);
    });

    it.each([
      ['1', '2'],
      ['1.9.1', '1.9'],
      ['1.9-beta', '1.9'],
    ])('%s != %s', (a, b) => {
      expect(versioning.equals(a, b)).toBe(false);
    });
  });

  describe('getMajor', () => {
    it.each([
      ['1', 1],
      ['1.9', 1],
      ['1.9.0', 1],
    ])('%s -> %i', (version, expected) => {
      expect(versioning.getMajor(version)).toEqual(expected);
    });
  });

  describe('getMinor', () => {
    it.each([
      ['1', 0],
      ['1.9', 9],
      ['1.9.0', 9],
    ])('%s -> %i', (version, expected) => {
      expect(versioning.getMinor(version)).toEqual(expected);
    });
  });

  describe('getPatch', () => {
    it.each([
      ['1', 0],
      ['1.9', 0],
      ['1.9.0', 0],
      ['1.9.4', 4],
    ])('%s -> %i', (version, expected) => {
      expect(versioning.getPatch(version)).toEqual(expected);
    });
  });

  describe('isGreaterThan', () => {
    it.each([
      ['2', '1'],
      ['2.0', '1'],
      ['2.0.0', '1'],
      ['1.10.0', '1.9'],
      ['1.9', '1.9-beta'],
    ])('%s > %s', (a, b) => {
      expect(versioning.isGreaterThan(a, b)).toBe(true);
    });

    it.each([
      ['1', '1'],
      ['1.0', '1'],
      ['1.0.0', '1'],
      ['1.9.0', '1.9'],
    ])('%s <= %s', (a, b) => {
      expect(versioning.isGreaterThan(a, b)).toBe(false);
    });
  });

  describe('isStable', () => {
    it.each([
      ['1', true],
      ['1.9', true],
      ['1.9.0', true],
      ['1.9.4', true],
      ['1.9.4-beta', false],
    ])('%s -> %i', (version, expected) => {
      expect(versioning.isStable(version)).toEqual(expected);
    });
  });

  describe('isValid(input)', () => {
    it('supports isVersion', () => {
      expect(versioning.isVersion('1.2.3')).toBeTruthy();
    });

    it('understands rez version ranges', () => {
      expect(versioning.isValid('1.2.3..1.2.4')).toBeTruthy();
      expect(versioning.isValid('1.2..1.3')).toBeTruthy();
      expect(versioning.isValid('1.2..2')).toBeTruthy();
      expect(versioning.isValid('1..3')).toBeTruthy();
    });

    it('should return null for irregular versions', () => {
      expect(versioning.isValid('17.04.0')).toBeFalsy();
    });

    it('should support simple semver', () => {
      expect(versioning.isValid('1.2.3')).toBeTruthy();
      expect(versioning.isValid('v1.2.3')).toBeTruthy();
    });

    it('should support semver with dash', () => {
      expect(versioning.isValid('1.2.3-foo')).toBeTruthy();
    });

    it('should reject semver without dash', () => {
      expect(versioning.isValid('1.2.3foo')).toBeFalsy();
    });

    it('should support ranges', () => {
      expect(versioning.isValid('1.2.3+')).toBeTruthy();
      expect(versioning.isValid('1.2.3+<2')).toBeTruthy();
      expect(versioning.isValid('1.2.3..1.2.4')).toBeTruthy();
      expect(
        versioning.minSatisfyingVersion(
          ['1.2.3', '1.2.4', '1.2.5'],
          '1.2.3..1.2.4'
        )
      ).toBe('1.2.3');
      expect(
        versioning.getSatisfyingVersion(
          ['1.2.3', '1.2.4', '1.2.5'],
          '1.2.3..1.2.4'
        )
      ).toBe('1.2.3');
      expect(versioning.isLessThanRange('1.2.3', '1.2.3..1.2.4')).toBe(false);
      expect(versioning.isLessThanRange('1.2.3', '1.2.4..1.2.5')).toBe(true);
      expect(versioning.matches('1.2.3', '1.2.3..1.2.4')).toBe(true);
      expect(versioning.matches('1.2.4', '1.2.2..1.2.3')).toBe(false);
    });
  });

  describe('isSingleVersion()', () => {
    it('returns true if naked version', () => {
      expect(versioning.isSingleVersion('1.2.3')).toBeTruthy();
      expect(versioning.isSingleVersion('1.2.3-alpha.1')).toBeTruthy();
    });

    it('returns true if equals', () => {
      expect(versioning.isSingleVersion('==1.2.3')).toBeTruthy();
    });

    it('returns false when not version', () => {
      expect(versioning.isSingleVersion('1.*')).toBeFalsy();
    });
  });

  describe('matches()', () => {
    it('handles dots', () => {
      expect(versioning.matches('4.2.0', '4.2.0..5.0.0')).toBe(true);
      expect(versioning.matches('4.2', '4.2.0..5.0.0')).toBe(true);
      expect(versioning.matches('4.2', '4.2..5')).toBe(true);
      expect(versioning.matches('4.2.0', '4.2..5')).toBe(true);
      expect(versioning.matches('4.2.0', '4.2..5.0')).toBe(true);
      expect(versioning.matches('4.2.0', '4.2..5.0.0')).toBe(true);
      expect(versioning.matches('4.2.0', '2.0..3.0')).toBe(false);
      expect(versioning.matches('4.2.2', '4.2.0..4.2.4')).toBe(true);
    });

    it('handles short', () => {
      expect(versioning.matches('1.4', '1.4')).toBe(true);
    });
  });

  describe('isLessThanRange()', () => {
    it('handles dots', () => {
      expect(versioning.isLessThanRange('0.9.0', '1.0.0..2.0.0')).toBe(true);
      expect(versioning.isLessThanRange('1.9.0', '1.0.0..2.0.0')).toBe(false);
    });
  });

  describe('minSatisfyingVersion()', () => {
    it('handles dots', () => {
      expect(
        versioning.minSatisfyingVersion(
          ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
          '4'
        )
      ).toBe('4.2.0');
      expect(
        versioning.minSatisfyingVersion(
          ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
          '4..5'
        )
      ).toBe('4.2.0');
      expect(
        versioning.minSatisfyingVersion(
          ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
          '4..5.0'
        )
      ).toBe('4.2.0');
      expect(
        versioning.minSatisfyingVersion(
          ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
          '4.2..5.0'
        )
      ).toBe('4.2.0');
      expect(
        versioning.minSatisfyingVersion(
          ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
          '4.2.0..5.0'
        )
      ).toBe('4.2.0');
      expect(
        versioning.minSatisfyingVersion(
          ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
          '4.2.0..5.0.0'
        )
      ).toBe('4.2.0');
    });
  });

  describe('getNewValue()', () => {
    it('supports dots range update', () => {
      [
        ['1.2.3', 'auto', '1.2.3', '1.2.4', '1.2.4'],
        ['1.2.3', 'bump', '1.2.3', '1.2.4', '1.2.4'],
        ['1.2.3', 'replace', '1.2.3', '1.2.4', '1.2.4'],
        ['1.2.3', 'widen', '1.2.3', '1.2.4', '1.2.4'],
        ['7..8', 'replace', '7.2.3', '8.2.5', '7..9'],
        ['7.2..8', 'replace', '7.2.3', '8.2.5', '7.2..9'],
        ['7.2.3..8', 'replace', '7.2.3', '8.2.5', '7.2.3..9'],
        ['7..8.0', 'replace', '7.2.3', '8.2.5', '7..8.3'],
        ['7.2..8.0', 'replace', '7.2.3', '8.2.5', '7.2..8.3'],
        ['7.2.3..8.0', 'replace', '7.2.3', '8.2.5', '7.2.3..8.3'],
        ['7..8.0.0', 'replace', '7.2.3', '8.2.5', '7..8.3.0'],
        ['7.2..8.0.0', 'replace', '7.2.3', '8.2.5', '7.2..8.3.0'],
        ['7.2.3..8.0.0', 'replace', '7.2.3', '8.2.5', '7.2.3..8.3.0'],
        ['5..6', 'bump', '5.2.3', '5.2.5', '5.2.5..6'],
        ['5.2..6', 'bump', '5.2.3', '5.2.5', '5.2.5..6'],
        ['5.2.3..6', 'bump', '5.2.3', '5.2.5', '5.2.5..6'],
        ['5..6.0', 'bump', '5.2.3', '6.2.5', '6.2.5..6.3'],
        ['5.2..6.0', 'bump', '5.2.3', '6.2.5', '6.2.5..6.3'],
        ['5.2.3..6.0', 'bump', '5.2.3', '5.2.5', '5.2.5..6.0'],
        ['5..6.0.0', 'bump', '5.2.3', '5.2.5', '5.2.5..6.0.0'],
        ['5.2..6.0.0', 'bump', '5.2.3', '5.2.5', '5.2.5..6.0.0'],
        ['5.2.3..6.0.0', 'bump', '5.2.3', '5.2.5', '5.2.5..6.0.0'],
        ['1..2', 'widen', '1.2.3', '2.2.5', '1..3'],
        ['1.2..2', 'widen', '1.2.3', '2.2.5', '1.2..3'],
        ['1.2..2.0', 'widen', '1.2.3', '2.2.5', '1.2..2.3'],
        ['1.2.3..2.0', 'widen', '1.2.3', '2.2.5', '1.2.3..2.3'],
        ['1.2.3..2.0.0', 'widen', '1.2.3', '2.2.5', '1.2.3..2.3.0'],
      ].forEach(
        ([range, rangeStrategy, currentVersion, newVersion, result]) => {
          const newValue = versioning.getNewValue({
            currentValue: range,
            rangeStrategy: rangeStrategy as RangeStrategy,
            currentVersion,
            newVersion,
          });
          expect(newValue).toEqual(result);
        }
      );
    });

    it('supports lower bounds + range update', () => {
      [
        ['7+', 'replace', '7.2.3', '8.2.5', '7+'],
        ['7.2+', 'replace', '7.2.3', '8.2.5', '7.2+'],
        ['7.2.3+', 'replace', '7.2.3', '8.2.5', '7.2.3+'],
        ['5+', 'bump', '5.2.3', '6.2.5', '6.2.5+'],
        ['5.2+', 'bump', '5.2.3', '6.2.5', '6.2.5+'],
        ['5.2.3+', 'bump', '5.2.3', '6.2.5', '6.2.5+'],
        ['1+', 'widen', '1.2.3', '2.2.5', '1+'],
        ['1.2+', 'widen', '1.2.3', '2.2.5', '1.2+'],
        ['1.2.3+', 'widen', '1.2.3', '2.2.5', '1.2.3+'],
      ].forEach(
        ([range, rangeStrategy, currentVersion, newVersion, result]) => {
          const newValue = versioning.getNewValue({
            currentValue: range,
            rangeStrategy: rangeStrategy as RangeStrategy,
            currentVersion,
            newVersion,
          });
          expect(newValue).toEqual(result);
        }
      );
    });

    it('supports lower bounds >=/> range update', () => {
      [
        ['>=7', 'replace', '7.2.3', '8.2.5', '>=7'],
        ['>=7.2', 'replace', '7.2.3', '8.2.5', '>=7.2'],
        ['>=7.2.3', 'replace', '7.2.3', '8.2.5', '>=7.2.3'],
        ['>=5', 'bump', '5.2.3', '6.2.5', '>=6.2.5'],
        ['>=5.2', 'bump', '5.2.3', '6.2.5', '>=6.2.5'],
        ['>=5.2.3', 'bump', '5.2.3', '6.2.5', '>=6.2.5'],
        ['>=1', 'widen', '1.2.3', '2.2.5', '>=1'],
        ['>=1.2', 'widen', '1.2.3', '2.2.5', '>=1.2'],
        ['>=1.2.3', 'widen', '1.2.3', '2.2.5', '>=1.2.3'],
        ['>7', 'replace', '7.2.3', '8.2.5', '>7'],
        ['>7.2', 'replace', '7.2.3', '8.2.5', '>7.2'],
        ['>7.2.2', 'replace', '7.2.3', '8.2.5', '>7.2.2'],
        ['>5', 'bump', '5.2.3', '6.2.5', '>5'],
        ['>5.2', 'bump', '5.2.3', '6.2.5', '>5.2'],
        ['>5.2.3', 'bump', '5.2.3', '6.2.5', '>5.2.3'],
        ['>1', 'widen', '1.2.3', '2.2.5', '>1'],
        ['>1.2', 'widen', '1.2.3', '2.2.5', '>1.2'],
        ['>1.2.3', 'widen', '1.2.3', '2.2.5', '>1.2.3'],
      ].forEach(
        ([range, rangeStrategy, currentVersion, newVersion, result]) => {
          const newValue = versioning.getNewValue({
            currentValue: range,
            rangeStrategy: rangeStrategy as RangeStrategy,
            currentVersion,
            newVersion,
          });
          expect(newValue).toEqual(result);
        }
      );
    });

    it('supports upper bounds <=/< range update', () => {
      [
        ['<=8', 'replace', '7.2.3', '8.2.5', '<=8.2.5'],
        ['<=7.3', 'replace', '7.2.3', '8.2.5', '<=8.2.5'],
        ['<=7.2.3', 'replace', '7.2.3', '8.2.5', '<=8.2.5'],
        ['<=6', 'bump', '5.2.3', '6.2.5', '<=6.2.5'],
        ['<=5.3', 'bump', '5.2.3', '6.2.5', '<=6.2.5'],
        ['<=5.2.3', 'bump', '5.2.3', '6.2.5', '<=6.2.5'],
        ['<=2', 'widen', '1.2.3', '2.2.5', '<=2.2.5'],
        ['<=1.3', 'widen', '1.2.3', '2.2.5', '<=2.2.5'],
        ['<=1.2.3', 'widen', '1.2.3', '2.2.5', '<=2.2.5'],
        ['<8', 'replace', '7.2.3', '8.2.5', '<9'],
        ['<7.3', 'replace', '7.2.3', '8.2.5', '<9.0'],
        ['<7.2.4', 'replace', '7.2.3', '8.2.5', '<9.0.0'],
        ['<6', 'bump', '5.2.3', '6.2.5', '<7'],
        ['<5.3', 'bump', '5.2.3', '6.2.5', '<7.0'],
        ['<5.2.4', 'bump', '5.2.3', '6.2.5', '<7.0.0'],
        ['<2', 'widen', '1.2.3', '2.2.5', '<3'],
        ['<1.3', 'widen', '1.2.3', '2.2.5', '<3.0'],
        ['<1.2.4', 'widen', '1.2.3', '2.2.5', '<3.0.0'],
      ].forEach(
        ([range, rangeStrategy, currentVersion, newVersion, result]) => {
          const newValue = versioning.getNewValue({
            currentValue: range,
            rangeStrategy: rangeStrategy as RangeStrategy,
            currentVersion,
            newVersion,
          });
          expect(newValue).toEqual(result);
        }
      );
    });

    it('supports ascending range +< update', () => {
      [
        ['7+<8', 'replace', '7.2.3', '8.2.5', '7+<9'],
        ['7.2+<8', 'replace', '7.2.3', '8.2.5', '7.2+<9'],
        ['7.2.3+<8', 'replace', '7.2.3', '8.2.5', '7.2.3+<9'],
        ['7+<8.0', 'replace', '7.2.3', '8.2.5', '7+<8.3'],
        ['7.2+<8.0', 'replace', '7.2.3', '8.2.5', '7.2+<8.3'],
        ['7.2.3+<8.0', 'replace', '7.2.3', '8.2.5', '7.2.3+<8.3'],
        ['7+<8.0.0', 'replace', '7.2.3', '8.2.5', '7+<8.3.0'],
        ['7.2+<8.0.0', 'replace', '7.2.3', '8.2.5', '7.2+<8.3.0'],
        ['7.2.3+<8.0.0', 'replace', '7.2.3', '8.2.5', '7.2.3+<8.3.0'],
        ['5+<6', 'bump', '5.2.3', '5.2.5', '5.2.5+<6'],
        ['5.2+<6', 'bump', '5.2.3', '5.2.5', '5.2.5+<6'],
        ['5.2.3+<6', 'bump', '5.2.3', '5.2.5', '5.2.5+<6'],
        ['5+<6.0', 'bump', '5.2.3', '6.2.5', '6.2.5+<6.3'],
        ['5.2+<6.0', 'bump', '5.2.3', '6.2.5', '6.2.5+<6.3'],
        ['5.2.3+<6.0', 'bump', '5.2.3', '5.2.5', '5.2.5+<6.0'],
        ['5+<6.0.0', 'bump', '5.2.3', '5.2.5', '5.2.5+<6.0.0'],
        ['5.2+<6.0.0', 'bump', '5.2.3', '5.2.5', '5.2.5+<6.0.0'],
        ['5.2.3+<6.0.0', 'bump', '5.2.3', '5.2.5', '5.2.5+<6.0.0'],
        ['1+<2', 'widen', '1.2.3', '2.2.5', '1+<3'],
        ['1.2+<2', 'widen', '1.2.3', '2.2.5', '1.2+<3'],
        ['1.2+<2.0', 'widen', '1.2.3', '2.2.5', '1.2+<2.3'],
        ['1.2.3+<2.0', 'widen', '1.2.3', '2.2.5', '1.2.3+<2.3'],
        ['1.2.3+<2.0.0', 'widen', '1.2.3', '2.2.5', '1.2.3+<2.3.0'],
      ].forEach(
        ([range, rangeStrategy, currentVersion, newVersion, result]) => {
          const newValue = versioning.getNewValue({
            currentValue: range,
            rangeStrategy: rangeStrategy as RangeStrategy,
            currentVersion,
            newVersion,
          });
          expect(newValue).toEqual(result);
        }
      );
    });

    it('supports ascending range >=,< update', () => {
      [
        ['>=7,<8', 'replace', '7.2.3', '8.2.5', '>=7,<9'],
        ['>=7.2,<8', 'replace', '7.2.3', '8.2.5', '>=7.2,<9'],
        ['>=7.2.3,<8', 'replace', '7.2.3', '8.2.5', '>=7.2.3,<9'],
        ['>=7,<8.0', 'replace', '7.2.3', '8.2.5', '>=7,<8.3'],
        ['>=7.2,<8.0', 'replace', '7.2.3', '8.2.5', '>=7.2,<8.3'],
        ['>=7.2.3,<8.0', 'replace', '7.2.3', '8.2.5', '>=7.2.3,<8.3'],
        ['>=7,<8.0.0', 'replace', '7.2.3', '8.2.5', '>=7,<8.3.0'],
        ['>=7.2,<8.0.0', 'replace', '7.2.3', '8.2.5', '>=7.2,<8.3.0'],
        ['>=7.2.3,<8.0.0', 'replace', '7.2.3', '8.2.5', '>=7.2.3,<8.3.0'],
        ['>=5,<6', 'bump', '5.2.3', '5.2.5', '>=5.2.5,<6'],
        ['>=5.2,<6', 'bump', '5.2.3', '5.2.5', '>=5.2.5,<6'],
        ['>=5.2.3,<6', 'bump', '5.2.3', '5.2.5', '>=5.2.5,<6'],
        ['>=5,<6.0', 'bump', '5.2.3', '6.2.5', '>=6.2.5,<6.3'],
        ['>=5.2,<6.0', 'bump', '5.2.3', '6.2.5', '>=6.2.5,<6.3'],
        ['>=5.2.3,<6.0', 'bump', '5.2.3', '5.2.5', '>=5.2.5,<6.0'],
        ['>=5,<6.0.0', 'bump', '5.2.3', '5.2.5', '>=5.2.5,<6.0.0'],
        ['>=5.2,<6.0.0', 'bump', '5.2.3', '5.2.5', '>=5.2.5,<6.0.0'],
        ['>=5.2.3,<6.0.0', 'bump', '5.2.3', '5.2.5', '>=5.2.5,<6.0.0'],
        ['>=1,<2', 'widen', '1.2.3', '2.2.5', '>=1,<3'],
        ['>=1.2,<2', 'widen', '1.2.3', '2.2.5', '>=1.2,<3'],
        ['>=1.2,<2.0', 'widen', '1.2.3', '2.2.5', '>=1.2,<2.3'],
        ['>=1.2.3,<2.0', 'widen', '1.2.3', '2.2.5', '>=1.2.3,<2.3'],
        ['>=1.2.3,<2.0.0', 'widen', '1.2.3', '2.2.5', '>=1.2.3,<2.3.0'],
      ].forEach(
        ([range, rangeStrategy, currentVersion, newVersion, result]) => {
          const newValue = versioning.getNewValue({
            currentValue: range,
            rangeStrategy: rangeStrategy as RangeStrategy,
            currentVersion,
            newVersion,
          });
          expect(newValue).toEqual(result);
        }
      );
    });

    it('supports ascending range >= < update', () => {
      [
        ['>=7<8', 'replace', '7.2.3', '8.2.5', '>=7<9'],
        ['>=7.2<8', 'replace', '7.2.3', '8.2.5', '>=7.2<9'],
        ['>=7.2.3<8', 'replace', '7.2.3', '8.2.5', '>=7.2.3<9'],
        ['>=7<8.0', 'replace', '7.2.3', '8.2.5', '>=7<8.3'],
        ['>=7.2<8.0', 'replace', '7.2.3', '8.2.5', '>=7.2<8.3'],
        ['>=7.2.3<8.0', 'replace', '7.2.3', '8.2.5', '>=7.2.3<8.3'],
        ['>=7<8.0.0', 'replace', '7.2.3', '8.2.5', '>=7<8.3.0'],
        ['>=7.2<8.0.0', 'replace', '7.2.3', '8.2.5', '>=7.2<8.3.0'],
        ['>=7.2.3<8.0.0', 'replace', '7.2.3', '8.2.5', '>=7.2.3<8.3.0'],
        ['>=5<6', 'bump', '5.2.3', '5.2.5', '>=5.2.5<6'],
        ['>=5.2<6', 'bump', '5.2.3', '5.2.5', '>=5.2.5<6'],
        ['>=5.2.3<6', 'bump', '5.2.3', '5.2.5', '>=5.2.5<6'],
        ['>=5<6.0', 'bump', '5.2.3', '6.2.5', '>=6.2.5<6.3'],
        ['>=5.2<6.0', 'bump', '5.2.3', '6.2.5', '>=6.2.5<6.3'],
        ['>=5.2.3<6.0', 'bump', '5.2.3', '5.2.5', '>=5.2.5<6.0'],
        ['>=5<6.0.0', 'bump', '5.2.3', '5.2.5', '>=5.2.5<6.0.0'],
        ['>=5.2<6.0.0', 'bump', '5.2.3', '5.2.5', '>=5.2.5<6.0.0'],
        ['>=5.2.3<6.0.0', 'bump', '5.2.3', '5.2.5', '>=5.2.5<6.0.0'],
        ['>=1<2', 'widen', '1.2.3', '2.2.5', '>=1<3'],
        ['>=1.2<2', 'widen', '1.2.3', '2.2.5', '>=1.2<3'],
        ['>=1.2<2.0', 'widen', '1.2.3', '2.2.5', '>=1.2<2.3'],
        ['>=1.2.3<2.0', 'widen', '1.2.3', '2.2.5', '>=1.2.3<2.3'],
        ['>=1.2.3<2.0.0', 'widen', '1.2.3', '2.2.5', '>=1.2.3<2.3.0'],
      ].forEach(
        ([range, rangeStrategy, currentVersion, newVersion, result]) => {
          const newValue = versioning.getNewValue({
            currentValue: range,
            rangeStrategy: rangeStrategy as RangeStrategy,
            currentVersion,
            newVersion,
          });
          expect(newValue).toEqual(result);
        }
      );
    });

    it('supports ascending range >,< update', () => {
      [
        ['>6,<8', 'replace', '7.2.3', '8.2.5', '>6,<9'],
        ['>7.1,<8', 'replace', '7.2.3', '8.2.5', '>7.1,<9'],
        ['>7.2.0,<8', 'replace', '7.2.3', '8.2.5', '>7.2.0,<9'],
        ['>6,<8.0', 'replace', '7.2.3', '8.2.5', '>6,<8.3'],
        ['>7.1,<8.0', 'replace', '7.2.3', '8.2.5', '>7.1,<8.3'],
        ['>7.2.0,<8.0', 'replace', '7.2.3', '8.2.5', '>7.2.0,<8.3'],
        ['>6,<8.0.0', 'replace', '7.2.3', '8.2.5', '>6,<8.3.0'],
        ['>7.1,<8.0.0', 'replace', '7.2.3', '8.2.5', '>7.1,<8.3.0'],
        ['>7.2.0,<8.0.0', 'replace', '7.2.3', '8.2.5', '>7.2.0,<8.3.0'],
        ['>4,<6', 'bump', '5.2.3', '5.2.5', '>4,<6'],
        ['>5.1,<6', 'bump', '5.2.3', '5.2.5', '>5.1,<6'],
        ['>5.2.0,<6', 'bump', '5.2.3', '5.2.5', '>5.2.0,<6'],
        ['>5,<6.0', 'bump', '5.2.3', '6.2.5', '>5,<6.3'],
        ['>5.1,<6.0', 'bump', '5.2.3', '6.2.5', '>5.1,<6.3'],
        ['>5.2.0,<6.0', 'bump', '5.2.3', '5.2.5', '>5.2.0,<6.0'],
        ['>5,<6.0.0', 'bump', '5.2.3', '5.2.5', '>5,<6.0.0'],
        ['>5.1,<6.0.0', 'bump', '5.2.3', '5.2.5', '>5.1,<6.0.0'],
        ['>5.2.0,<6.0.0', 'bump', '5.2.3', '5.2.5', '>5.2.0,<6.0.0'],
        ['>1,<2', 'widen', '1.2.3', '2.2.5', '>1,<3'],
        ['>1.1,<2', 'widen', '1.2.3', '2.2.5', '>1.1,<3'],
        ['>1.1,<2.0', 'widen', '1.2.3', '2.2.5', '>1.1,<2.3'],
        ['>1.2.0,<2.0', 'widen', '1.2.3', '2.2.5', '>1.2.0,<2.3'],
        ['>1.2.0,<2.0.0', 'widen', '1.2.3', '2.2.5', '>1.2.0,<2.3.0'],
      ].forEach(
        ([range, rangeStrategy, currentVersion, newVersion, result]) => {
          const newValue = versioning.getNewValue({
            currentValue: range,
            rangeStrategy: rangeStrategy as RangeStrategy,
            currentVersion,
            newVersion,
          });
          expect(newValue).toEqual(result);
        }
      );
    });

    it('supports ascending range > < update', () => {
      [
        ['>6<8', 'replace', '7.2.3', '8.2.5', '>6<9'],
        ['>7.1<8', 'replace', '7.2.3', '8.2.5', '>7.1<9'],
        ['>7.2.0<8', 'replace', '7.2.3', '8.2.5', '>7.2.0<9'],
        ['>6<8.0', 'replace', '7.2.3', '8.2.5', '>6<8.3'],
        ['>7.1<8.0', 'replace', '7.2.3', '8.2.5', '>7.1<8.3'],
        ['>7.2.0<8.0', 'replace', '7.2.3', '8.2.5', '>7.2.0<8.3'],
        ['>6<8.0.0', 'replace', '7.2.3', '8.2.5', '>6<8.3.0'],
        ['>7.1<8.0.0', 'replace', '7.2.3', '8.2.5', '>7.1<8.3.0'],
        ['>7.2.0<8.0.0', 'replace', '7.2.3', '8.2.5', '>7.2.0<8.3.0'],
        ['>4<6', 'bump', '5.2.3', '5.2.5', '>4<6'],
        ['>5.1<6', 'bump', '5.2.3', '5.2.5', '>5.1<6'],
        ['>5.2.0<6', 'bump', '5.2.3', '5.2.5', '>5.2.0<6'],
        ['>5<6.0', 'bump', '5.2.3', '6.2.5', '>5<6.3'],
        ['>5.1<6.0', 'bump', '5.2.3', '6.2.5', '>5.1<6.3'],
        ['>5.2.0<6.0', 'bump', '5.2.3', '5.2.5', '>5.2.0<6.0'],
        ['>4<6.0.0', 'bump', '5.2.3', '5.2.5', '>4<6.0.0'],
        ['>5.1<6.0.0', 'bump', '5.2.3', '5.2.5', '>5.1<6.0.0'],
        ['>5.2.0<6.0.0', 'bump', '5.2.3', '5.2.5', '>5.2.0<6.0.0'],
        ['>1<2', 'widen', '1.2.3', '2.2.5', '>1<3'],
        ['>1.1<2', 'widen', '1.2.3', '2.2.5', '>1.1<3'],
        ['>1.1<2.0', 'widen', '1.2.3', '2.2.5', '>1.1<2.3'],
        ['>1.2.0<2.0', 'widen', '1.2.3', '2.2.5', '>1.2.0<2.3'],
        ['>1.2.0<2.0.0', 'widen', '1.2.3', '2.2.5', '>1.2.0<2.3.0'],
      ].forEach(
        ([range, rangeStrategy, currentVersion, newVersion, result]) => {
          const newValue = versioning.getNewValue({
            currentValue: range,
            rangeStrategy: rangeStrategy as RangeStrategy,
            currentVersion,
            newVersion,
          });
          expect(newValue).toEqual(result);
        }
      );
    });

    it('supports descending range <,>= update', () => {
      [
        ['<8,>=7', 'replace', '7.2.3', '8.2.5', '<9,>=7'],
        ['<8,>=7.2', 'replace', '7.2.3', '8.2.5', '<9,>=7.2'],
        ['<8,>=7.2.3', 'replace', '7.2.3', '8.2.5', '<9,>=7.2.3'],
        ['<8.0,>=7', 'replace', '7.2.3', '8.2.5', '<8.3,>=7'],
        ['<8.0,>=7.2', 'replace', '7.2.3', '8.2.5', '<8.3,>=7.2'],
        ['<8.0,>=7.2.3', 'replace', '7.2.3', '8.2.5', '<8.3,>=7.2.3'],
        ['<8.0.0,>=7', 'replace', '7.2.3', '8.2.5', '<8.3.0,>=7'],
        ['<8.0.0,>=7.2', 'replace', '7.2.3', '8.2.5', '<8.3.0,>=7.2'],
        ['<8.0.0,>=7.2.3', 'replace', '7.2.3', '8.2.5', '<8.3.0,>=7.2.3'],
        ['<6,>=5', 'bump', '5.2.3', '5.2.5', '<6,>=5.2.5'],
        ['<6,>=5.2', 'bump', '5.2.3', '5.2.5', '<6,>=5.2.5'],
        ['<6,>=5.2.3', 'bump', '5.2.3', '5.2.5', '<6,>=5.2.5'],
        ['<6.0,>=5', 'bump', '5.2.3', '6.2.5', '<6.3,>=6.2.5'],
        ['<6.0,>=5.2', 'bump', '5.2.3', '6.2.5', '<6.3,>=6.2.5'],
        ['<6.0,>=5.2.3', 'bump', '5.2.3', '5.2.5', '<6.0,>=5.2.5'],
        ['<6.0.0,>=5', 'bump', '5.2.3', '5.2.5', '<6.0.0,>=5.2.5'],
        ['<6.0.0,>=5.2', 'bump', '5.2.3', '5.2.5', '<6.0.0,>=5.2.5'],
        ['<6.0.0,>=5.2.3', 'bump', '5.2.3', '5.2.5', '<6.0.0,>=5.2.5'],
        ['<2,>=1', 'widen', '1.2.3', '2.2.5', '<3,>=1'],
        ['<2,>=1.2', 'widen', '1.2.3', '2.2.5', '<3,>=1.2'],
        ['<2.0,>=1.2', 'widen', '1.2.3', '2.2.5', '<2.3,>=1.2'],
        ['<2.0,>=1.2.3', 'widen', '1.2.3', '2.2.5', '<2.3,>=1.2.3'],
        ['<2.0.0,>=1.2.3', 'widen', '1.2.3', '2.2.5', '<2.3.0,>=1.2.3'],
      ].forEach(
        ([range, rangeStrategy, currentVersion, newVersion, result]) => {
          const newValue = versioning.getNewValue({
            currentValue: range,
            rangeStrategy: rangeStrategy as RangeStrategy,
            currentVersion,
            newVersion,
          });
          expect(newValue).toEqual(result);
        }
      );
    });

    it('supports descending range <,> update', () => {
      [
        ['<8,>6', 'replace', '7.2.3', '8.2.5', '<9,>6'],
        ['<8,>7.1', 'replace', '7.2.3', '8.2.5', '<9,>7.1'],
        ['<8,>7.2.0', 'replace', '7.2.3', '8.2.5', '<9,>7.2.0'],
        ['<8.0,>6', 'replace', '7.2.3', '8.2.5', '<8.3,>6'],
        ['<8.0,>7.1', 'replace', '7.2.3', '8.2.5', '<8.3,>7.1'],
        ['<8.0,>7.2.0', 'replace', '7.2.3', '8.2.5', '<8.3,>7.2.0'],
        ['<8.0.0,>6', 'replace', '7.2.3', '8.2.5', '<8.3.0,>6'],
        ['<8.0.0,>7.1', 'replace', '7.2.3', '8.2.5', '<8.3.0,>7.1'],
        ['<8.0.0,>7.2.0', 'replace', '7.2.3', '8.2.5', '<8.3.0,>7.2.0'],
        ['<6,>4', 'bump', '5.2.3', '5.2.5', '<6,>4'],
        ['<6,>5.1', 'bump', '5.2.3', '5.2.5', '<6,>5.1'],
        ['<6,>5.2.0', 'bump', '5.2.3', '5.2.5', '<6,>5.2.0'],
        ['<6.0,>5', 'bump', '5.2.3', '6.2.5', '<6.3,>5'],
        ['<6.0,>5.1', 'bump', '5.2.3', '6.2.5', '<6.3,>5.1'],
        ['<6.0,>5.2.0', 'bump', '5.2.3', '5.2.5', '<6.0,>5.2.0'],
        ['<6.0.0,>5', 'bump', '5.2.3', '5.2.5', '<6.0.0,>5'],
        ['<6.0.0,>5.1', 'bump', '5.2.3', '5.2.5', '<6.0.0,>5.1'],
        ['<6.0.0,>5.2.0', 'bump', '5.2.3', '5.2.5', '<6.0.0,>5.2.0'],
        ['<2,>1', 'widen', '1.2.3', '2.2.5', '<3,>1'],
        ['<2,>1.1', 'widen', '1.2.3', '2.2.5', '<3,>1.1'],
        ['<2.0,>1.1', 'widen', '1.2.3', '2.2.5', '<2.3,>1.1'],
        ['<2.0,>1.2.0', 'widen', '1.2.3', '2.2.5', '<2.3,>1.2.0'],
        ['<2.0.0,>1.2.0', 'widen', '1.2.3', '2.2.5', '<2.3.0,>1.2.0'],
      ].forEach(
        ([range, rangeStrategy, currentVersion, newVersion, result]) => {
          const newValue = versioning.getNewValue({
            currentValue: range,
            rangeStrategy: rangeStrategy as RangeStrategy,
            currentVersion,
            newVersion,
          });
          expect(newValue).toEqual(result);
        }
      );
    });
  });
});
