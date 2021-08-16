import { api as semver } from '.';

describe('versioning/hashicorp/index', () => {
  it('matches', () => {
    expect(semver.matches('4.2.0', '~> 4.0')).toBe(true);
    expect(semver.matches('4.2.0', '~> 4.0.0')).toBe(false);
  });

  it('getSatisfyingVersion', () => {
    expect(
      semver.getSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '~> 4.0'
      )
    ).toBe('4.2.0');
    expect(
      semver.getSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '~> 4.0.0'
      )
    ).toBe('4.0.0');
  });

  it('isValid', () => {
    expect(semver.isValid('>= 1.0.0, <= 2.0.0')).toBeTruthy();
  });

  it('isLessThanRange', () => {
    expect(semver.isLessThanRange('0.9.0', '>= 1.0.0, <= 2.0.0')).toBe(true);
    expect(semver.isLessThanRange('1.9.0', '>= 1.0.0, <= 2.0.0')).toBe(false);
  });

  it('minSatisfyingVersion', () => {
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '~> 4.0'
      )
    ).toBe('4.2.0');
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '~> 4.0.0'
      )
    ).toBeNull();
  });

  it('getNewValue', () => {
    expect(
      semver.getNewValue({
        currentValue: '~> 1.2',
        rangeStrategy: 'replace',
        currentVersion: '1.2.3',
        newVersion: '2.0.7',
      })
    ).toEqual('~> 2.0');
    expect(
      semver.getNewValue({
        currentValue: '~> 1.2.0',
        rangeStrategy: 'replace',
        currentVersion: '1.2.3',
        newVersion: '2.0.7',
      })
    ).toEqual('~> 2.0.0');
    expect(
      semver.getNewValue({
        currentValue: '~> 0.14.0',
        rangeStrategy: 'replace',
        currentVersion: '0.14.1',
        newVersion: '0.15.0',
      })
    ).toEqual('~> 0.15.0');
    expect(
      semver.getNewValue({
        currentValue: '~> 0.14.0',
        rangeStrategy: 'replace',
        currentVersion: '0.14.1',
        newVersion: '0.15.1',
      })
    ).toEqual('~> 0.15.0');
    expect(
      semver.getNewValue({
        currentValue: '~> 0.14.6',
        rangeStrategy: 'replace',
        currentVersion: '0.14.6',
        newVersion: '0.15.0',
      })
    ).toEqual('~> 0.15.0');
  });
  it('handles comma dividers', () => {
    expect(
      semver.getNewValue({
        currentValue: '>= 1.0.0, <= 2.0.0',
        rangeStrategy: 'widen',
        currentVersion: '1.2.3',
        newVersion: '2.0.7',
      })
    ).toEqual('>= 1.0.0, <= 2.0.7');
  });
  it('updates short ranges', () => {
    expect(
      semver.getNewValue({
        currentValue: '0.14',
        rangeStrategy: 'replace',
        currentVersion: '0.14.2',
        newVersion: '0.15.0',
      })
    ).toEqual('0.15');
    expect(
      semver.getNewValue({
        currentValue: '~> 0.14',
        rangeStrategy: 'replace',
        currentVersion: '0.14.2',
        newVersion: '0.15.0',
      })
    ).toEqual('~> 0.15');
  });
});
