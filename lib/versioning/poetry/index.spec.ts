import { getName } from '../../../test/util';
import { api as versionig } from '.';

describe(getName(__filename), () => {
  describe('equals', () => {
    it.each([
      ['1', '1'],
      ['1.0', '1'],
      ['1.0.0', '1'],
      ['1.9.0', '1.9'],
    ])('%s == %s', (a, b) => {
      expect(versionig.equals(a, b)).toBe(true);
    });

    it.each([
      ['1', '2'],
      ['1.9.1', '1.9'],
      ['1.9-beta', '1.9'],
    ])('%s != %s', (a, b) => {
      expect(versionig.equals(a, b)).toBe(false);
    });
  });

  describe('getMajor', () => {
    it.each([
      ['1', 1],
      ['1.9', 1],
      ['1.9.0', 1],
    ])('%s -> %i', (version, expected) => {
      expect(versionig.getMajor(version)).toEqual(expected);
    });
  });

  describe('getMinor', () => {
    it.each([
      ['1', 0],
      ['1.9', 9],
      ['1.9.0', 9],
    ])('%s -> %i', (version, expected) => {
      expect(versionig.getMinor(version)).toEqual(expected);
    });
  });

  describe('getPatch', () => {
    it.each([
      ['1', 0],
      ['1.9', 0],
      ['1.9.0', 0],
      ['1.9.4', 4],
    ])('%s -> %i', (version, expected) => {
      expect(versionig.getPatch(version)).toEqual(expected);
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
      expect(versionig.isGreaterThan(a, b)).toBe(true);
    });

    it.each([
      ['1', '1'],
      ['1.0', '1'],
      ['1.0.0', '1'],
      ['1.9.0', '1.9'],
    ])('%s <= %s', (a, b) => {
      expect(versionig.isGreaterThan(a, b)).toBe(false);
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
      expect(versionig.isStable(version)).toEqual(expected);
    });
  });

  describe('isValid(input)', () => {
    it('should return null for irregular versions', () => {
      expect(versionig.isValid('17.04.0')).toBeFalsy();
    });
    it('should support simple semver', () => {
      expect(versionig.isValid('1.2.3')).toBeTruthy();
    });
    it('should support semver with dash', () => {
      expect(versionig.isValid('1.2.3-foo')).toBeTruthy();
    });
    it('should reject semver without dash', () => {
      expect(versionig.isValid('1.2.3foo')).toBeFalsy();
    });
    it('should work with wildcards', () => {
      expect(versionig.isValid('*')).toBeTruthy();
    });
    it('should support ranges', () => {
      expect(versionig.isValid('~1.2.3')).toBeTruthy();
      expect(versionig.isValid('^1.2.3')).toBeTruthy();
      expect(versionig.isValid('>1.2.3')).toBeTruthy();
    });
    it('should reject github repositories', () => {
      expect(versionig.isValid('renovatebot/renovate')).toBeFalsy();
      expect(versionig.isValid('renovatebot/renovate#master')).toBeFalsy();
      expect(
        versionig.isValid('https://github.com/renovatebot/renovate.git')
      ).toBeFalsy();
    });
  });
  describe('isSingleVersion()', () => {
    it('returns true if naked version', () => {
      expect(versionig.isSingleVersion('1.2.3')).toBeTruthy();
      expect(versionig.isSingleVersion('1.2.3-alpha.1')).toBeTruthy();
    });
    it('returns true if equals', () => {
      expect(versionig.isSingleVersion('=1.2.3')).toBeTruthy();
      expect(versionig.isSingleVersion('= 1.2.3')).toBeTruthy();
    });
    it('returns false when not version', () => {
      expect(versionig.isSingleVersion('1.*')).toBeFalsy();
    });
  });
  describe('matches()', () => {
    it('handles comma', () => {
      expect(versionig.matches('4.2.0', '4.2, >= 3.0, < 5.0.0')).toBe(true);
      expect(versionig.matches('4.2.0', '2.0, >= 3.0, < 5.0.0')).toBe(false);
      expect(versionig.matches('4.2.2', '4.2.0, < 4.2.4')).toBe(false);
      expect(versionig.matches('4.2.2', '^4.2.0, < 4.2.4')).toBe(true);
      expect(versionig.matches('4.2.0', '4.3.0, 3.0.0')).toBe(false);
      expect(versionig.matches('4.2.0', '> 5.0.0, <= 6.0.0')).toBe(false);
    });
    it('handles wildcards', () => {
      expect(versionig.matches('4.2.0', '*')).toBe(true);
    });
  });
  describe('isLessThanRange()', () => {
    it('handles comma', () => {
      expect(versionig.isLessThanRange('0.9.0', '>= 1.0.0 <= 2.0.0')).toBe(
        true
      );
      expect(versionig.isLessThanRange('1.9.0', '>= 1.0.0 <= 2.0.0')).toBe(
        false
      );
    });
  });
  describe('minSatisfyingVersion()', () => {
    it('handles comma', () => {
      expect(
        versionig.minSatisfyingVersion(
          ['0.4.0', '0.5.0', '4.2.0', '4.3.0', '5.0.0'],
          '4.*, > 4.2'
        )
      ).toBe('4.3.0');
      expect(
        versionig.minSatisfyingVersion(
          ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
          '^4.0.0'
        )
      ).toBe('4.2.0');
      expect(
        versionig.minSatisfyingVersion(
          ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
          '^4.0.0, = 0.5.0'
        )
      ).toBeNull();
      expect(
        versionig.minSatisfyingVersion(
          ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
          '^4.0.0, > 4.1.0, <= 4.3.5'
        )
      ).toBe('4.2.0');
      expect(
        versionig.minSatisfyingVersion(
          ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
          '^6.2.0, 3.*'
        )
      ).toBeNull();
    });
  });
  describe('getSatisfyingVersion()', () => {
    it('handles comma', () => {
      expect(
        versionig.getSatisfyingVersion(
          ['4.2.1', '0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
          '4.*.0, < 4.2.5'
        )
      ).toBe('4.2.1');
      expect(
        versionig.getSatisfyingVersion(
          ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0', '5.0.3'],
          '5.0, > 5.0.0'
        )
      ).toBe('5.0.3');
    });
  });

  describe('getNewValue()', () => {
    it('bumps exact', () => {
      expect(
        versionig.getNewValue({
          currentValue: '1.0.0',
          rangeStrategy: 'bump',
          currentVersion: '1.0.0',
          newVersion: '1.1.0',
        })
      ).toEqual('1.1.0');
      expect(
        versionig.getNewValue({
          currentValue: '   1.0.0',
          rangeStrategy: 'bump',
          currentVersion: '1.0.0',
          newVersion: '1.1.0',
        })
      ).toEqual('1.1.0');
      expect(
        versionig.getNewValue({
          currentValue: '1.0.0',
          rangeStrategy: 'bump',
          currentVersion: '1.0.0',
          newVersion: '1.1.0',
        })
      ).toEqual('1.1.0');
    });
    it('bumps equals', () => {
      expect(
        versionig.getNewValue({
          currentValue: '=1.0.0',
          rangeStrategy: 'bump',
          currentVersion: '1.0.0',
          newVersion: '1.1.0',
        })
      ).toEqual('=1.1.0');
      expect(
        versionig.getNewValue({
          currentValue: '=  1.0.0',
          rangeStrategy: 'bump',
          currentVersion: '1.0.0',
          newVersion: '1.1.0',
        })
      ).toEqual('=1.1.0');
    });
    it('bumps equals space', () => {
      expect(
        versionig.getNewValue({
          currentValue: '= 1.0.0',
          rangeStrategy: 'bump',
          currentVersion: '1.0.0',
          newVersion: '1.1.0',
        })
      ).toEqual('=1.1.0');
      expect(
        versionig.getNewValue({
          currentValue: '  = 1.0.0',
          rangeStrategy: 'bump',
          currentVersion: '1.0.0',
          newVersion: '1.1.0',
        })
      ).toEqual('=1.1.0');
      expect(
        versionig.getNewValue({
          currentValue: '  =   1.0.0',
          rangeStrategy: 'bump',
          currentVersion: '1.0.0',
          newVersion: '1.1.0',
        })
      ).toEqual('=1.1.0');
      expect(
        versionig.getNewValue({
          currentValue: '=    1.0.0',
          rangeStrategy: 'bump',
          currentVersion: '1.0.0',
          newVersion: '1.1.0',
        })
      ).toEqual('=1.1.0');
    });
    it('bumps short caret to same', () => {
      expect(
        versionig.getNewValue({
          currentValue: '^1.0',
          rangeStrategy: 'bump',
          currentVersion: '1.0.0',
          newVersion: '1.0.7',
        })
      ).toEqual('^1.0');
    });
    it('replaces caret with newer', () => {
      expect(
        versionig.getNewValue({
          currentValue: '^1.0.0',
          rangeStrategy: 'replace',
          currentVersion: '1.0.0',
          newVersion: '2.0.7',
        })
      ).toEqual('^2.0.0');
    });
    it('handles precision change caret', () => {
      expect(
        versionig.getNewValue({
          currentValue: '^5.0.3',
          rangeStrategy: 'replace',
          currentVersion: '5.3.1',
          newVersion: '5.5',
        })
      ).toEqual('^5.0.3');
    });
    it('replaces naked version', () => {
      expect(
        versionig.getNewValue({
          currentValue: '1.0.0',
          rangeStrategy: 'replace',
          currentVersion: '1.0.0',
          newVersion: '2.0.7',
        })
      ).toEqual('2.0.7');
    });
    it('replaces with version range', () => {
      expect(
        versionig.getNewValue({
          currentValue: '1.0.0',
          rangeStrategy: 'replace',
          currentVersion: '1.0.0',
          newVersion: '^2.0.7',
        })
      ).toEqual('^2.0.7');
    });
    it('bumps naked caret', () => {
      expect(
        versionig.getNewValue({
          currentValue: '^1',
          rangeStrategy: 'bump',
          currentVersion: '1.0.0',
          newVersion: '2.1.7',
        })
      ).toEqual('^2');
    });
    it('bumps naked tilde', () => {
      expect(
        versionig.getNewValue({
          currentValue: '~1',
          rangeStrategy: 'bump',
          currentVersion: '1.0.0',
          newVersion: '1.1.7',
        })
      ).toEqual('~1');
    });
    it('bumps naked major', () => {
      expect(
        versionig.getNewValue({
          currentValue: '5',
          rangeStrategy: 'bump',
          currentVersion: '5.0.0',
          newVersion: '5.1.7',
        })
      ).toEqual('5');
      expect(
        versionig.getNewValue({
          currentValue: '5',
          rangeStrategy: 'bump',
          currentVersion: '5.0.0',
          newVersion: '6.1.7',
        })
      ).toEqual('6');
    });
    it('bumps naked minor', () => {
      expect(
        versionig.getNewValue({
          currentValue: '5.0',
          rangeStrategy: 'bump',
          currentVersion: '5.0.0',
          newVersion: '5.0.7',
        })
      ).toEqual('5.0');
      expect(
        versionig.getNewValue({
          currentValue: '5.0',
          rangeStrategy: 'bump',
          currentVersion: '5.0.0',
          newVersion: '5.1.7',
        })
      ).toEqual('5.1');
      expect(
        versionig.getNewValue({
          currentValue: '5.0',
          rangeStrategy: 'bump',
          currentVersion: '5.0.0',
          newVersion: '6.1.7',
        })
      ).toEqual('6.1');
    });
    it('replaces minor', () => {
      expect(
        versionig.getNewValue({
          currentValue: '5.0',
          rangeStrategy: 'replace',
          currentVersion: '5.0.0',
          newVersion: '6.1.7',
        })
      ).toEqual('6.1');
    });
    it('replaces equals', () => {
      expect(
        versionig.getNewValue({
          currentValue: '=1.0.0',
          rangeStrategy: 'replace',
          currentVersion: '1.0.0',
          newVersion: '1.1.0',
        })
      ).toEqual('=1.1.0');
    });
    it('bumps caret to prerelease', () => {
      expect(
        versionig.getNewValue({
          currentValue: '^1',
          rangeStrategy: 'bump',
          currentVersion: '1.0.0',
          newVersion: '1.0.7-prerelease.1',
        })
      ).toEqual('^1.0.7-prerelease.1');
    });
    it('replaces with newer', () => {
      expect(
        versionig.getNewValue({
          currentValue: '^1.0.0',
          rangeStrategy: 'replace',
          currentVersion: '1.0.0',
          newVersion: '1.2.3',
        })
      ).toEqual('^1.0.0');
    });
    it('bumps short tilde', () => {
      expect(
        versionig.getNewValue({
          currentValue: '~1.0',
          rangeStrategy: 'bump',
          currentVersion: '1.0.0',
          newVersion: '1.1.7',
        })
      ).toEqual('~1.1');
    });
    it('handles long asterisk', () => {
      expect(
        versionig.getNewValue({
          currentValue: '1.0.*',
          rangeStrategy: 'replace',
          currentVersion: '1.0.0',
          newVersion: '1.1.0',
        })
      ).toEqual('1.1.*');
    });
    it('handles short asterisk', () => {
      expect(
        versionig.getNewValue({
          currentValue: '1.*',
          rangeStrategy: 'replace',
          currentVersion: '1.0.0',
          newVersion: '2.1.0',
        })
      ).toEqual('2.*');
    });
    it('handles updating from stable to unstable', () => {
      expect(
        versionig.getNewValue({
          currentValue: '~0.6.1',
          rangeStrategy: 'replace',
          currentVersion: '0.6.8',
          newVersion: '0.7.0-rc.2',
        })
      ).toEqual('~0.7.0-rc');
    });
    it('handles less than version requirements', () => {
      expect(
        versionig.getNewValue({
          currentValue: '<1.3.4',
          rangeStrategy: 'replace',
          currentVersion: '1.2.3',
          newVersion: '1.5.0',
        })
      ).toEqual('<1.5.1');
      expect(
        versionig.getNewValue({
          currentValue: '< 1.3.4',
          rangeStrategy: 'replace',
          currentVersion: '1.2.3',
          newVersion: '1.5.0',
        })
      ).toEqual('< 1.5.1');
      expect(
        versionig.getNewValue({
          currentValue: '<   1.3.4',
          rangeStrategy: 'replace',
          currentVersion: '1.2.3',
          newVersion: '1.5.0',
        })
      ).toEqual('< 1.5.1');
    });
    it('handles less than equals version requirements', () => {
      expect(
        versionig.getNewValue({
          currentValue: '<=1.3.4',
          rangeStrategy: 'replace',
          currentVersion: '1.2.3',
          newVersion: '1.5.0',
        })
      ).toEqual('<=1.5.0');
      expect(
        versionig.getNewValue({
          currentValue: '<= 1.3.4',
          rangeStrategy: 'replace',
          currentVersion: '1.2.3',
          newVersion: '1.5.0',
        })
      ).toEqual('<= 1.5.0');
      expect(
        versionig.getNewValue({
          currentValue: '<=   1.3.4',
          rangeStrategy: 'replace',
          currentVersion: '1.2.3',
          newVersion: '1.5.0',
        })
      ).toEqual('<= 1.5.0');
    });
    it('handles replacing short caret versions', () => {
      expect(
        versionig.getNewValue({
          currentValue: '^1.2',
          rangeStrategy: 'replace',
          currentVersion: '1.2.3',
          newVersion: '2.0.0',
        })
      ).toEqual('^2.0');
      expect(
        versionig.getNewValue({
          currentValue: '^1',
          rangeStrategy: 'replace',
          currentVersion: '1.2.3',
          newVersion: '2.0.0',
        })
      ).toEqual('^2');
    });
    it('handles replacing short tilde versions', () => {
      expect(
        versionig.getNewValue({
          currentValue: '~1.2',
          rangeStrategy: 'replace',
          currentVersion: '1.2.3',
          newVersion: '2.0.0',
        })
      ).toEqual('~2.0');
      expect(
        versionig.getNewValue({
          currentValue: '~1',
          rangeStrategy: 'replace',
          currentVersion: '1.2.3',
          newVersion: '2.0.0',
        })
      ).toEqual('~2');
    });
    it('widens range', () => {
      expect(
        versionig.getNewValue({
          currentValue: '^2.2',
          rangeStrategy: 'widen',
          currentVersion: '2.2.0',
          newVersion: '3.0.0',
        })
      ).toEqual('^2.2 || ^3.0.0');
    });
  });

  describe('sortVersions()', () => {
    it.each([
      ['2', '1'],
      ['2.0', '1'],
      ['2.0.0', '1'],
      ['1.10.0', '1.9'],
      ['1.9', '1.9-beta'],
    ])('%s > %s', (a, b) => {
      expect(versionig.sortVersions(a, b)).toBe(1);
    });

    it.each([
      ['1', '1'],
      ['1.0', '1'],
      ['1.0.0', '1'],
      ['1.9.0', '1.9'],
    ])('%s == %s', (a, b) => {
      expect(versionig.sortVersions(a, b)).toBe(0);
    });
  });
});
