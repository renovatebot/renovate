import { api as semver } from '.';

describe('semver.isValid(input)', () => {
  it('should return null for irregular versions', () => {
    expect(semver.isValid('17.04.0')).toBeFalsy();
  });
  it('should support simple semver', () => {
    expect(semver.isValid('1.2.3')).toBeTruthy();
  });
  it('should support semver with dash', () => {
    expect(semver.isValid('1.2.3-foo')).toBeTruthy();
  });
  it('should reject semver without dash', () => {
    expect(semver.isValid('1.2.3foo')).toBeFalsy();
  });
  it('should work with wildcards', () => {
    expect(semver.isValid('*')).toBeTruthy();
  });
  it('should support ranges', () => {
    expect(semver.isValid('~1.2.3')).toBeTruthy();
    expect(semver.isValid('^1.2.3')).toBeTruthy();
    expect(semver.isValid('>1.2.3')).toBeTruthy();
  });
  it('should reject github repositories', () => {
    expect(semver.isValid('renovatebot/renovate')).toBeFalsy();
    expect(semver.isValid('renovatebot/renovate#master')).toBeFalsy();
    expect(
      semver.isValid('https://github.com/renovatebot/renovate.git')
    ).toBeFalsy();
  });
});
describe('semver.isSingleVersion()', () => {
  it('returns true if naked version', () => {
    expect(semver.isSingleVersion('1.2.3')).toBeTruthy();
    expect(semver.isSingleVersion('1.2.3-alpha.1')).toBeTruthy();
  });
  it('returns true if equals', () => {
    expect(semver.isSingleVersion('=1.2.3')).toBeTruthy();
    expect(semver.isSingleVersion('= 1.2.3')).toBeTruthy();
  });
  it('returns false when not version', () => {
    expect(semver.isSingleVersion('1.*')).toBeFalsy();
  });
});
describe('semver.matches()', () => {
  it('handles comma', () => {
    expect(semver.matches('4.2.0', '4.2, >= 3.0, < 5.0.0')).toBe(true);
    expect(semver.matches('4.2.0', '2.0, >= 3.0, < 5.0.0')).toBe(false);
    expect(semver.matches('4.2.2', '4.2.0, < 4.2.4')).toBe(false);
    expect(semver.matches('4.2.2', '^4.2.0, < 4.2.4')).toBe(true);
    expect(semver.matches('4.2.0', '4.3.0, 3.0.0')).toBe(false);
    expect(semver.matches('4.2.0', '> 5.0.0, <= 6.0.0')).toBe(false);
  });
  it('handles wildcards', () => {
    expect(semver.matches('4.2.0', '*')).toBe(true);
  });
});
describe('semver.isLessThanRange()', () => {
  it('handles comma', () => {
    expect(semver.isLessThanRange('0.9.0', '>= 1.0.0 <= 2.0.0')).toBe(true);
    expect(semver.isLessThanRange('1.9.0', '>= 1.0.0 <= 2.0.0')).toBe(false);
  });
});
describe('semver.minSatisfyingVersion()', () => {
  it('handles comma', () => {
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '4.3.0', '5.0.0'],
        '4.*, > 4.2'
      )
    ).toBe('4.3.0');
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '^4.0.0'
      )
    ).toBe('4.2.0');
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '^4.0.0, = 0.5.0'
      )
    ).toBeNull();
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '^4.0.0, > 4.1.0, <= 4.3.5'
      )
    ).toBe('4.2.0');
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '^6.2.0, 3.*'
      )
    ).toBeNull();
  });
});
describe('semver.getSatisfyingVersion()', () => {
  it('handles comma', () => {
    expect(
      semver.getSatisfyingVersion(
        ['4.2.1', '0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '4.*.0, < 4.2.5'
      )
    ).toBe('4.2.1');
    expect(
      semver.getSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0', '5.0.3'],
        '5.0, > 5.0.0'
      )
    ).toBe('5.0.3');
  });
});

describe('semver.getNewValue()', () => {
  it('bumps exact', () => {
    expect(
      semver.getNewValue({
        currentValue: '1.0.0',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      })
    ).toEqual('1.1.0');
    expect(
      semver.getNewValue({
        currentValue: '   1.0.0',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      })
    ).toEqual('1.1.0');
    expect(
      semver.getNewValue({
        currentValue: '1.0.0',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      })
    ).toEqual('1.1.0');
  });
  it('bumps equals', () => {
    expect(
      semver.getNewValue({
        currentValue: '=1.0.0',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      })
    ).toEqual('=1.1.0');
    expect(
      semver.getNewValue({
        currentValue: '=  1.0.0',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      })
    ).toEqual('=1.1.0');
  });
  it('bumps equals space', () => {
    expect(
      semver.getNewValue({
        currentValue: '= 1.0.0',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      })
    ).toEqual('=1.1.0');
    expect(
      semver.getNewValue({
        currentValue: '  = 1.0.0',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      })
    ).toEqual('=1.1.0');
    expect(
      semver.getNewValue({
        currentValue: '  =   1.0.0',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      })
    ).toEqual('=1.1.0');
    expect(
      semver.getNewValue({
        currentValue: '=    1.0.0',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      })
    ).toEqual('=1.1.0');
  });
  it('bumps short caret to same', () => {
    expect(
      semver.getNewValue({
        currentValue: '^1.0',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.0.7',
      })
    ).toEqual('^1.0');
  });
  it('replaces caret with newer', () => {
    expect(
      semver.getNewValue({
        currentValue: '^1.0.0',
        rangeStrategy: 'replace',
        currentVersion: '1.0.0',
        newVersion: '2.0.7',
      })
    ).toEqual('^2.0.0');
  });
  it('replaces naked version', () => {
    expect(
      semver.getNewValue({
        currentValue: '1.0.0',
        rangeStrategy: 'replace',
        currentVersion: '1.0.0',
        newVersion: '2.0.7',
      })
    ).toEqual('2.0.7');
  });
  it('replaces with version range', () => {
    expect(
      semver.getNewValue({
        currentValue: '1.0.0',
        rangeStrategy: 'replace',
        currentVersion: '1.0.0',
        newVersion: '^2.0.7',
      })
    ).toEqual('^2.0.7');
  });
  it('bumps naked caret', () => {
    expect(
      semver.getNewValue({
        currentValue: '^1',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '2.1.7',
      })
    ).toEqual('^2');
  });
  it('bumps naked tilde', () => {
    expect(
      semver.getNewValue({
        currentValue: '~1',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.1.7',
      })
    ).toEqual('~1');
  });
  it('bumps naked major', () => {
    expect(
      semver.getNewValue({
        currentValue: '5',
        rangeStrategy: 'bump',
        currentVersion: '5.0.0',
        newVersion: '5.1.7',
      })
    ).toEqual('5');
    expect(
      semver.getNewValue({
        currentValue: '5',
        rangeStrategy: 'bump',
        currentVersion: '5.0.0',
        newVersion: '6.1.7',
      })
    ).toEqual('6');
  });
  it('bumps naked minor', () => {
    expect(
      semver.getNewValue({
        currentValue: '5.0',
        rangeStrategy: 'bump',
        currentVersion: '5.0.0',
        newVersion: '5.0.7',
      })
    ).toEqual('5.0');
    expect(
      semver.getNewValue({
        currentValue: '5.0',
        rangeStrategy: 'bump',
        currentVersion: '5.0.0',
        newVersion: '5.1.7',
      })
    ).toEqual('5.1');
    expect(
      semver.getNewValue({
        currentValue: '5.0',
        rangeStrategy: 'bump',
        currentVersion: '5.0.0',
        newVersion: '6.1.7',
      })
    ).toEqual('6.1');
  });
  it('replaces minor', () => {
    expect(
      semver.getNewValue({
        currentValue: '5.0',
        rangeStrategy: 'replace',
        currentVersion: '5.0.0',
        newVersion: '6.1.7',
      })
    ).toEqual('6.1');
  });
  it('replaces equals', () => {
    expect(
      semver.getNewValue({
        currentValue: '=1.0.0',
        rangeStrategy: 'replace',
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      })
    ).toEqual('=1.1.0');
  });
  it('bumps caret to prerelease', () => {
    expect(
      semver.getNewValue({
        currentValue: '^1',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.0.7-prerelease.1',
      })
    ).toEqual('^1.0.7-prerelease.1');
  });
  it('replaces with newer', () => {
    expect(
      semver.getNewValue({
        currentValue: '^1.0.0',
        rangeStrategy: 'replace',
        currentVersion: '1.0.0',
        newVersion: '1.0.7',
      })
    ).toEqual('^1.0.7');
  });
  it('bumps short tilde', () => {
    expect(
      semver.getNewValue({
        currentValue: '~1.0',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.1.7',
      })
    ).toEqual('~1.1');
  });
  it('handles long asterisk', () => {
    expect(
      semver.getNewValue({
        currentValue: '1.0.*',
        rangeStrategy: 'replace',
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      })
    ).toEqual('1.1.*');
  });
  it('handles short asterisk', () => {
    expect(
      semver.getNewValue({
        currentValue: '1.*',
        rangeStrategy: 'replace',
        currentVersion: '1.0.0',
        newVersion: '2.1.0',
      })
    ).toEqual('2.*');
  });
  it('handles updating from stable to unstable', () => {
    expect(
      semver.getNewValue({
        currentValue: '~0.6.1',
        rangeStrategy: 'replace',
        currentVersion: '0.6.8',
        newVersion: '0.7.0-rc.2',
      })
    ).toEqual('~0.7.0-rc');
  });
  it('handles less than version requirements', () => {
    expect(
      semver.getNewValue({
        currentValue: '<1.3.4',
        rangeStrategy: 'replace',
        currentVersion: '1.2.3',
        newVersion: '1.5.0',
      })
    ).toEqual('<1.5.1');
    expect(
      semver.getNewValue({
        currentValue: '< 1.3.4',
        rangeStrategy: 'replace',
        currentVersion: '1.2.3',
        newVersion: '1.5.0',
      })
    ).toEqual('< 1.5.1');
    expect(
      semver.getNewValue({
        currentValue: '<   1.3.4',
        rangeStrategy: 'replace',
        currentVersion: '1.2.3',
        newVersion: '1.5.0',
      })
    ).toEqual('< 1.5.1');
  });
  it('handles less than equals version requirements', () => {
    expect(
      semver.getNewValue({
        currentValue: '<=1.3.4',
        rangeStrategy: 'replace',
        currentVersion: '1.2.3',
        newVersion: '1.5.0',
      })
    ).toEqual('<=1.5.0');
    expect(
      semver.getNewValue({
        currentValue: '<= 1.3.4',
        rangeStrategy: 'replace',
        currentVersion: '1.2.3',
        newVersion: '1.5.0',
      })
    ).toEqual('<= 1.5.0');
    expect(
      semver.getNewValue({
        currentValue: '<=   1.3.4',
        rangeStrategy: 'replace',
        currentVersion: '1.2.3',
        newVersion: '1.5.0',
      })
    ).toEqual('<= 1.5.0');
  });
  it('handles replacing short caret versions', () => {
    expect(
      semver.getNewValue({
        currentValue: '^1.2',
        rangeStrategy: 'replace',
        currentVersion: '1.2.3',
        newVersion: '2.0.0',
      })
    ).toEqual('^2.0');
    expect(
      semver.getNewValue({
        currentValue: '^1',
        rangeStrategy: 'replace',
        currentVersion: '1.2.3',
        newVersion: '2.0.0',
      })
    ).toEqual('^2');
  });
  it('handles replacing short tilde versions', () => {
    expect(
      semver.getNewValue({
        currentValue: '~1.2',
        rangeStrategy: 'replace',
        currentVersion: '1.2.3',
        newVersion: '2.0.0',
      })
    ).toEqual('~2.0');
    expect(
      semver.getNewValue({
        currentValue: '~1',
        rangeStrategy: 'replace',
        currentVersion: '1.2.3',
        newVersion: '2.0.0',
      })
    ).toEqual('~2');
  });
  it('widens range', () => {
    expect(
      semver.getNewValue({
        currentValue: '^2.2',
        rangeStrategy: 'widen',
        currentVersion: '2.2.0',
        newVersion: '3.0.0',
      })
    ).toEqual('^2.2 || ^3.0.0');
  });
});
