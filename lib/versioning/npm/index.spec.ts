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
    expect(semver.isSingleVersion('1.x')).toBeFalsy();
  });
});
describe('semver.getNewValue()', () => {
  it('bumps equals', () => {
    expect(
      semver.getNewValue({
        currentValue: '=1.0.0',
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
    [
      ['^0.0.3', '0.0.6', '^0.0.6'],
      ['^0.0.3', '0.5.0', '^0.5.0'],
      ['^0.0.3', '0.5.6', '^0.5.0'],
      ['^0.0.3', '4.0.0', '^4.0.0'],
      ['^0.0.3', '4.0.6', '^4.0.0'],
      ['^0.0.3', '4.5.6', '^4.0.0'],
      ['^0.2.0', '0.5.6', '^0.5.0'],
      ['^0.2.3', '0.5.0', '^0.5.0'],
      ['^0.2.3', '0.5.6', '^0.5.0'],
      ['^1.2.3', '4.0.0', '^4.0.0'],
      ['^1.2.3', '4.5.6', '^4.0.0'],
      ['^1.0.0', '4.5.6', '^4.0.0'],

      ['^0.2.3', '0.2.4', '^0.2.3'],
      ['^2.3.0', '2.4.0', '^2.3.0'],
      ['^2.3.4', '2.4.5', '^2.3.4'],
      ['^0.0.1', '0.0.2', '^0.0.2'],
      ['^1.0.1', '2.0.2', '^2.0.0'],
      ['^1.2.3', '1.2.3', '^1.2.3'],
      ['^1.2.3', '1.2.2', '^1.2.2'],

      ['^0.9.21', '0.9.22', '^0.9.21'], // #4762
    ].forEach(([currentValue, newVersion, expectedValue]) => {
      expect(
        semver.getNewValue({
          currentValue,
          rangeStrategy: 'replace',
          currentVersion: currentValue.replace('^', ''),
          newVersion,
        })
      ).toEqual(expectedValue);
    });
  });
  it('supports tilde greater than', () => {
    expect(
      semver.getNewValue({
        currentValue: '~> 1.0.0',
        rangeStrategy: 'replace',
        currentVersion: '1.0.0',
        newVersion: '1.1.7',
      })
    ).toEqual('~> 1.1.0');
  });
  it('bumps short caret to new', () => {
    expect(
      semver.getNewValue({
        currentValue: '^1.0',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.1.7',
      })
    ).toEqual('^1.1');
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
  it('bumps tilde to prerelease', () => {
    expect(
      semver.getNewValue({
        currentValue: '~1.0',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.0.7-prerelease.1',
      })
    ).toEqual('~1.0.7-prerelease.1');
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
  it('bumps greater or equals', () => {
    expect(
      semver.getNewValue({
        currentValue: '>=1.0.0',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      })
    ).toEqual('>=1.1.0');
    expect(
      semver.getNewValue({
        currentValue: '>= 1.0.0',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      })
    ).toEqual('>= 1.1.0');
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
  it('bumps complex ranges', () => {
    expect(
      semver.getNewValue({
        currentValue: '>= 0.1.21 < 0.2.0',
        rangeStrategy: 'bump',
        currentVersion: '0.1.21',
        newVersion: '0.1.24',
      })
    ).toEqual('>= 0.1.24 < 0.2.0');
    expect(
      semver.getNewValue({
        currentValue: '>= 0.1.21 <= 0.2.0',
        rangeStrategy: 'bump',
        currentVersion: '0.1.21',
        newVersion: '0.1.24',
      })
    ).toEqual('>= 0.1.24 <= 0.2.0');
    expect(
      semver.getNewValue({
        currentValue: '>= 0.0.1 <= 0.1',
        rangeStrategy: 'bump',
        currentVersion: '0.0.1',
        newVersion: '0.0.2',
      })
    ).toEqual('>= 0.0.2 <= 0.1');
    expect(
      semver.getNewValue({
        currentValue: '>= 0.0.1 < 0.1',
        rangeStrategy: 'bump',
        currentVersion: '0.1.0',
        newVersion: '0.2.1',
      })
    ).toEqual('>= 0.2.1 < 0.3');
    expect(
      semver.getNewValue({
        currentValue: '>= 0.0.1 < 0.0.4',
        rangeStrategy: 'bump',
        currentVersion: '0.0.4',
        newVersion: '0.0.5',
      })
    ).toEqual('>= 0.0.5 < 0.0.6');
    expect(
      semver.getNewValue({
        currentValue: '>= 0.0.1 < 1',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.0.1',
      })
    ).toEqual('>= 1.0.1 < 2');
    expect(
      semver.getNewValue({
        currentValue: '>= 0.0.1 < 1',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.0.1',
      })
    ).toEqual('>= 1.0.1 < 2');
  });
  it('widens', () => {
    expect(
      semver.getNewValue({
        currentValue: '<=1.2.3',
        rangeStrategy: 'widen',
        currentVersion: '1.0.0',
        newVersion: '1.2.3',
      })
    ).toEqual('<=1.2.3');
    expect(
      semver.getNewValue({
        currentValue: '<=1.2.3',
        rangeStrategy: 'widen',
        currentVersion: '1.0.0',
        newVersion: '1.2.4',
      })
    ).toEqual('<=1.2.4');
    expect(
      semver.getNewValue({
        currentValue: '>=1.2.3',
        rangeStrategy: 'widen',
        currentVersion: '1.0.0',
        newVersion: '1.2.3',
      })
    ).toEqual('>=1.2.3');
    expect(
      semver.getNewValue({
        currentValue: '>=1.2.3',
        rangeStrategy: 'widen',
        currentVersion: '1.0.0',
        newVersion: '1.2.1',
      })
    ).toEqual('>=1.2.3 || 1.2.1');
  });
});
