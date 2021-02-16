import { api as semver } from '.';

describe('semver.matches()', () => {
  it('handles comma', () => {
    expect(semver.matches('4.2.0', '4.2, >= 3.0, < 5.0.0')).toBe(true);
    expect(semver.matches('4.2.0', '2.0, >= 3.0, < 5.0.0')).toBe(false);
    expect(semver.matches('4.2.0', '4.2.0, < 4.2.4')).toBe(true);
    expect(semver.matches('4.2.0', '4.3.0, 3.0.0')).toBe(false);
    expect(semver.matches('4.2.0', '> 5.0.0, <= 6.0.0')).toBe(false);
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
describe('semver.isValid()', () => {
  it('simple constraints are valid', () => {
    expect(semver.isValid('1')).toBeTruthy();
    expect(semver.isValid('1.2')).toBeTruthy();
    expect(semver.isValid('1.2.3')).toBeTruthy();
    expect(semver.isValid('^1.2.3')).toBeTruthy();
    expect(semver.isValid('~1.2.3')).toBeTruthy();
    expect(semver.isValid('1.2.*')).toBeTruthy();
  });
  it('handles comma', () => {
    expect(semver.isValid('< 3.0, >= 1.0.0 <= 2.0.0')).toBeTruthy();
    expect(semver.isValid('< 3.0, >= 1.0.0 <= 2.0.0, = 5.1.2')).toBeTruthy();
  });
});
describe('semver.isVersion()', () => {
  it('handles comma', () => {
    expect(semver.isVersion('1.2.3')).toBeTruthy();
    expect(semver.isValid('1.2')).toBeTruthy();
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
      semver.minSatisfyingVersion(['0.4.0', '0.5.0', '4.2.0', '5.0.0'], '4.0.0')
    ).toBe('4.2.0');
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '4.0.0, = 0.5.0'
      )
    ).toBeNull();
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '4.0.0, > 4.1.0, <= 4.3.5'
      )
    ).toBe('4.2.0');
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '6.2.0, 3.*'
      )
    ).toBeNull();
  });
});
describe('semver.isSingleVersion()', () => {
  it('returns false if naked version', () => {
    expect(semver.isSingleVersion('1.2.3')).toBeFalsy();
    expect(semver.isSingleVersion('1.2.3-alpha.1')).toBeFalsy();
  });
  it('returns true if equals', () => {
    expect(semver.isSingleVersion('=1.2.3')).toBeTruthy();
    expect(semver.isSingleVersion('= 1.2.3')).toBeTruthy();
    expect(semver.isSingleVersion('  = 1.2.3')).toBeTruthy();
  });
  it('returns false for partial versions', () => {
    expect(semver.isSingleVersion('1')).toBeFalsy();
    expect(semver.isSingleVersion('1.2')).toBeFalsy();
  });
  it('returns false for wildcard constraints', () => {
    expect(semver.isSingleVersion('*')).toBeFalsy();
    expect(semver.isSingleVersion('1.*')).toBeFalsy();
    expect(semver.isSingleVersion('1.2.*')).toBeFalsy();
  });
});
describe('semver.getNewValue()', () => {
  it('returns if empty or *', () => {
    expect(
      semver.getNewValue({
        currentValue: null,
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      })
    ).toBeNull();
    expect(
      semver.getNewValue({
        currentValue: '*',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      })
    ).toEqual('*');
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
        currentValue: '   =1.0.0',
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
    ).toEqual('= 1.1.0');
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
    ).toEqual('= 1.1.0');
  });
  it('bumps version range', () => {
    expect(
      semver.getNewValue({
        currentValue: '1.0.0',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      })
    ).toEqual('1.1.0');
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
  it('replaces with newer', () => {
    expect(
      semver.getNewValue({
        currentValue: '^1.0.0',
        rangeStrategy: 'replace',
        currentVersion: '1.0.0',
        newVersion: '2.0.7',
      })
    ).toEqual('^2.0.0');
  });
  it('replaces with version range', () => {
    expect(
      semver.getNewValue({
        currentValue: '1.0.0',
        rangeStrategy: 'replace',
        currentVersion: '1.0.0',
        newVersion: '2.0.7',
      })
    ).toEqual('2.0.0');
  });
  it('updates naked caret', () => {
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
  it('bumps complex ranges', () => {
    expect(
      semver.getNewValue({
        currentValue: '>= 0.1.21, < 0.2.0',
        rangeStrategy: 'bump',
        currentVersion: '0.1.21',
        newVersion: '0.1.24',
      })
    ).toEqual('>= 0.1.24, < 0.2.0');
    expect(
      semver.getNewValue({
        currentValue: '>= 0.1.21, <= 0.2.0',
        rangeStrategy: 'bump',
        currentVersion: '0.1.21',
        newVersion: '0.1.24',
      })
    ).toEqual('>= 0.1.24, <= 0.2.0');
    expect(
      semver.getNewValue({
        currentValue: '>= 0.0.1, <= 0.1',
        rangeStrategy: 'bump',
        currentVersion: '0.0.1',
        newVersion: '0.0.2',
      })
    ).toEqual('>= 0.0.2, <= 0.1');
    expect(
      semver.getNewValue({
        currentValue: '>= 1.2.3, <= 1',
        rangeStrategy: 'bump',
        currentVersion: '1.2.3',
        newVersion: '1.2.4',
      })
    ).toEqual('>= 1.2.4, <= 1');
    expect(
      semver.getNewValue({
        currentValue: '>= 1.2.3, <= 1.0',
        rangeStrategy: 'bump',
        currentVersion: '1.2.3',
        newVersion: '1.2.4',
      })
    ).toEqual('>= 1.2.4, <= 1.2');
    expect(
      semver.getNewValue({
        currentValue: '>= 0.0.1, < 0.1',
        rangeStrategy: 'bump',
        currentVersion: '0.1.0',
        newVersion: '0.2.1',
      })
    ).toEqual('>= 0.2.1, < 0.3');
  });
});
