import { api as semver } from '.';

describe('versioning/composer/index', () => {
  it('gets patch', () => {
    expect(semver.getPatch('1.2.0')).toEqual(0);
  });

  it('equals', () => {
    expect(semver.equals('1.2.0', 'v1.2')).toBe(true);
    expect(semver.equals('v1.0.0', '1')).toBe(true);
    expect(semver.equals('1.0@alpha3', '1.0.0-alpha.3')).toBe(true);
    expect(semver.equals('1.0@beta', '1.0.0-beta')).toBe(true);
    expect(semver.equals('1.0@rc2', '1.0.0-rc.2')).toBe(true);
  });

  it('should pad versions', () => {
    expect(semver.isGreaterThan('1.2.0', 'v1.2')).toBe(false);
    expect(semver.isGreaterThan('v1.0.1', '1')).toBe(true);
    expect(semver.isGreaterThan('1', '1.1')).toBe(false);
    expect(semver.isSingleVersion('v1.2')).toBeTruthy();
    expect(semver.isStable('v1.2')).toBeTruthy();
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

  it('should support ranges with stability modifiers', () => {
    expect(semver.isValid('~1.2.3-beta1')).toBeTruthy();
    expect(semver.isValid('^1.2.3-alpha')).toBeTruthy();
    expect(semver.isValid('>1.2.3-rc2')).toBeTruthy();
  });

  it('should support ranges with min-stability', () => {
    expect(semver.isValid('~1.2.3@beta')).toBeTruthy();
    expect(semver.isValid('^1.2.3@alpha')).toBeTruthy();
    expect(semver.isValid('>1.2.3@rc')).toBeTruthy();
  });

  it('should support simple semver', () => {
    expect(semver.isValid('1.2.3')).toBeTruthy();
  });

  it('should support shortened version', () => {
    expect(semver.isValid('2.5')).toBeTruthy();
  });

  it('should support shortened v version', () => {
    expect(semver.isValid('v2.5')).toBeTruthy();
  });

  it('isLessThanRange', () => {
    expect(semver.isLessThanRange('0.3.1', '~0.4')).toBe(true);
    expect(semver.isLessThanRange('0.5.1', '~0.4')).toBe(false);
  });

  it('getSatisfyingVersion', () => {
    expect(
      semver.getSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '~4'
      )
    ).toBe('4.2.0');
    expect(
      semver.getSatisfyingVersion(
        ['v0.4.0', 'v0.5.0', 'v4.0.0', 'v4.2.0', 'v5.0.0'],
        '~4'
      )
    ).toBe('4.2.0');
    expect(
      semver.getSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '~0.4'
      )
    ).toBe('0.5.0');
    expect(
      semver.getSatisfyingVersion(
        [
          '0.4.0',
          '0.5.0',
          '4.0.0-beta1',
          '4.0.0-beta2',
          '4.2.0-beta1',
          '4.2.0-beta2',
          '5.0.0',
        ],
        '~4@beta'
      )
    ).toBe('4.0.0-beta2');
  });

  it('handles massaged tilde', () => {
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '~4'
      )
    ).toBe('4.0.0');
    expect(
      semver.minSatisfyingVersion(
        ['v0.4.0', 'v0.5.0', 'v4.0.0', 'v4.2.0', 'v5.0.0'],
        '~4'
      )
    ).toBe('4.0.0');
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '~0.4'
      )
    ).toBe('0.4.0');
  });

  it('handles prereleases', () => {
    expect(
      semver.minSatisfyingVersion(
        [
          '0.4.0',
          '0.5.0',
          '4.0.0-beta1',
          '4.0.0',
          '4.2.0-beta1',
          '4.2.0-beta2',
          '5.0.0',
        ],
        '~4@beta'
      )
    ).toBe('4.0.0-beta1');
  });

  it('matches', () => {
    expect(semver.matches('0.3.1', '~0.4')).toBe(false);
    expect(semver.matches('0.5.1', '~0.4')).toBe(true);
  });

  it('returns pinned newVersion', () => {
    expect(
      semver.getNewValue({
        currentValue: '~1.0',
        rangeStrategy: 'pin',
        currentVersion: '1.0',
        newVersion: 'V1.1',
      })
    ).toEqual('V1.1');
    expect(
      semver.getNewValue({
        currentValue: '^1.0',
        rangeStrategy: 'pin',
        currentVersion: '1.0',
        newVersion: 'V1.1',
      })
    ).toEqual('V1.1');
  });

  it('returns newVersion', () => {
    expect(
      semver.getNewValue({
        currentValue: 'v1.0',
        rangeStrategy: 'replace',
        currentVersion: '1.0',
        newVersion: '1.1',
      })
    ).toEqual('v1.1');
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

  it('bumps less than to same', () => {
    expect(
      semver.getNewValue({
        currentValue: '<2.7.14',
        rangeStrategy: 'bump',
        currentVersion: '2.0.3',
        newVersion: '2.0.4',
      })
    ).toEqual('<2.7.14');
  });

  it('bumps caret to same', () => {
    expect(
      semver.getNewValue({
        currentValue: '^1.0.0',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.3.5',
      })
    ).toEqual('^1.3.5');
  });

  it('replaces caret to same', () => {
    expect(
      semver.getNewValue({
        currentValue: '^1',
        rangeStrategy: 'replace',
        currentVersion: '1.0.0',
        newVersion: '1.3.5',
      })
    ).toEqual('^1');
  });

  it('replaces short caret', () => {
    expect(
      semver.getNewValue({
        currentValue: '^1.0',
        rangeStrategy: 'replace',
        currentVersion: '1.0.0',
        newVersion: '2.3.5',
      })
    ).toEqual('^2.0');
  });

  it('handles tilde zero', () => {
    expect(
      semver.getNewValue({
        currentValue: '~0.2',
        rangeStrategy: 'replace',
        currentVersion: '0.2.0',
        newVersion: '0.3.0',
      })
    ).toEqual('~0.3');
    expect(
      semver.getNewValue({
        currentValue: '~0.2',
        rangeStrategy: 'replace',
        currentVersion: '0.2.0',
        newVersion: '1.1.0',
      })
    ).toEqual('~1.0');
  });

  it('handles tilde major', () => {
    expect(
      semver.getNewValue({
        currentValue: '~4',
        rangeStrategy: 'replace',
        currentVersion: '4.0.0',
        newVersion: '4.2.0',
      })
    ).toEqual('~4');
    expect(
      semver.getNewValue({
        currentValue: '~4',
        rangeStrategy: 'replace',
        currentVersion: '4.0.0',
        newVersion: '5.1.0',
      })
    ).toEqual('~5');
  });

  it('handles tilde minor', () => {
    expect(
      semver.getNewValue({
        currentValue: '~4.0',
        rangeStrategy: 'replace',
        currentVersion: '4.0.0',
        newVersion: '5.1.0',
      })
    ).toEqual('~5.0');
    expect(
      semver.getNewValue({
        currentValue: '~4.0',
        rangeStrategy: 'replace',
        currentVersion: '4.0.0',
        newVersion: '4.1.0',
      })
    ).toEqual('~4.1');
    expect(
      semver.getNewValue({
        currentValue: '~1.2 || ~2.0',
        rangeStrategy: 'replace',
        currentVersion: '2.0.0',
        newVersion: '3.1.0',
      })
    ).toEqual('~3.0');
    expect(
      semver.getNewValue({
        currentValue: '~1.2 || ~2.0 || ~3.0',
        rangeStrategy: 'widen',
        currentVersion: '2.0.0',
        newVersion: '5.1.0',
      })
    ).toEqual('~1.2 || ~2.0 || ~3.0 || ~5.0');
  });

  it('handles widen strategy', () => {
    expect(
      semver.getNewValue({
        currentValue: '^1.2',
        rangeStrategy: 'widen',
        currentVersion: '1.2.0',
        newVersion: '2.0.0',
      })
    ).toEqual('^1.2 || ^2.0');
    expect(
      semver.getNewValue({
        currentValue: '~1.2',
        rangeStrategy: 'widen',
        currentVersion: '1.2.0',
        newVersion: '2.4.0',
      })
    ).toEqual('~1.2 || ~2.0');
    expect(
      semver.getNewValue({
        currentValue: '~1.2',
        rangeStrategy: 'widen',
        currentVersion: '1.2.0',
        newVersion: '1.9.0',
      })
    ).toEqual('~1.2');
    expect(
      semver.getNewValue({
        currentValue: '^1.2',
        rangeStrategy: 'widen',
        currentVersion: '1.2.0',
        newVersion: '1.9.0',
      })
    ).toEqual('^1.2');
    expect(
      semver.getNewValue({
        currentValue: '^1.0 || ^2.0',
        rangeStrategy: 'widen',
        currentVersion: '2.0.0',
        newVersion: '2.1.0',
      })
    ).toEqual('^1.0 || ^2.0');
    expect(
      semver.getNewValue({
        currentValue: '>=1.0 <3.0',
        rangeStrategy: 'widen',
        currentVersion: '2.9.0',
        newVersion: '4.1.0',
      })
    ).toEqual('>=1.0 <4.2');
    expect(
      semver.getNewValue({
        currentValue: '>=1.0 <3.0',
        rangeStrategy: 'widen',
        currentVersion: '2.9.0',
        newVersion: '2.9.5',
      })
    ).toEqual('>=1.0 <3.0');
    expect(
      semver.getNewValue({
        currentValue: '>=1.0 <3.0',
        rangeStrategy: 'widen',
        currentVersion: '2.9.0',
        newVersion: '3.0',
      })
    ).toEqual('>=1.0 <3.1');
    expect(
      semver.getNewValue({
        currentValue: '>=1.0.0 <=3.0.4',
        rangeStrategy: 'widen',
        currentVersion: '2.9.0',
        newVersion: '3.0.5',
      })
    ).toEqual('>=1.0.0 <=3.0.5');
    expect(
      semver.getNewValue({
        currentValue: '~1.0 || >=3.0 <=4.0',
        rangeStrategy: 'widen',
        currentVersion: '2.9.0',
        newVersion: '5.0.0',
      })
    ).toEqual('~1.0 || >=3.0 <=5.0');
  });

  it('returns newVersion if unsupported', () => {
    expect(
      semver.getNewValue({
        currentValue: '+4.0.0',
        rangeStrategy: 'replace',
        currentVersion: '4.0.0',
        newVersion: '4.2.0',
      })
    ).toEqual('4.2.0');
  });

  it('returns versioned newVersion', () => {
    expect(
      semver.getNewValue({
        currentValue: 'v4.0.0',
        rangeStrategy: 'replace',
        currentVersion: '4.0.0',
        newVersion: '4.2.0',
      })
    ).toEqual('v4.2.0');
  });

  it('bumps short caret with v', () => {
    expect(
      semver.getNewValue({
        currentValue: '^v1.0',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.1.7',
      })
    ).toEqual('^v1.1');
  });

  it('bumps short caret with stability modifiers', () => {
    expect(
      semver.getNewValue({
        currentValue: '^v1.0@beta',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0-beta3',
        newVersion: '1.0.0-beta5',
      })
    ).toEqual('^v1.0.0-beta5@beta');
  });

  it('replaces short caret with stability modifiers', () => {
    expect(
      semver.getNewValue({
        currentValue: '^v1.0@beta',
        rangeStrategy: 'replace',
        currentVersion: '1.0.0-beta3',
        newVersion: '2.0.0-beta5',
      })
    ).toEqual('^v2.0.0-beta5@beta');
  });

  it('preserves the current min-stability modifiers', () => {
    expect(
      semver.getNewValue({
        currentValue: '^4.0@alpha',
        rangeStrategy: 'replace',
        currentVersion: '4.0.0-alpha1',
        newVersion: '4.0.0-beta5',
      })
    ).toEqual('^4.0.0-beta5@alpha');
  });

  it('handles differing lengths', () => {
    expect(
      semver.getNewValue({
        currentValue: '3.6.*',
        rangeStrategy: 'replace',
        currentVersion: '3.6.0',
        newVersion: '3.7',
      })
    ).toEqual('3.7.*');

    expect(
      semver.getNewValue({
        currentValue: 'v3.1.*',
        rangeStrategy: 'replace',
        currentVersion: '3.1.10',
        newVersion: '3.2.0',
      })
    ).toEqual('v3.2.*'); // #5388
  });

  it('handles update-lockfile strategy', () => {
    expect(
      semver.getNewValue({
        currentValue: '^0.1',
        rangeStrategy: 'update-lockfile',
        currentVersion: '0.1.0',
        newVersion: '0.1.1',
      })
    ).toEqual('^0.1');
    expect(
      semver.getNewValue({
        currentValue: '^0.1',
        rangeStrategy: 'update-lockfile',
        currentVersion: '0.1.0',
        newVersion: '0.2.0',
      })
    ).toEqual('^0.2');

    expect(
      semver.getNewValue({
        currentValue: '^5.1',
        rangeStrategy: 'update-lockfile',
        currentVersion: '5.1.0',
        newVersion: '5.2.0',
      })
    ).toEqual('^5.1');
    expect(
      semver.getNewValue({
        currentValue: '^5.1',
        rangeStrategy: 'update-lockfile',
        currentVersion: '5.1.0',
        newVersion: '6.0.0',
      })
    ).toEqual('^6.0');

    expect(
      semver.getNewValue({
        currentValue: '^5',
        rangeStrategy: 'update-lockfile',
        currentVersion: '5.1.0',
        newVersion: '5.2.0',
      })
    ).toEqual('^5');
    expect(
      semver.getNewValue({
        currentValue: '^5',
        rangeStrategy: 'update-lockfile',
        currentVersion: '5.1.0',
        newVersion: '6.0.0',
      })
    ).toEqual('^6');
  });

  it('sorts versions in an ascending order', () => {
    expect(
      ['1.2.3-beta', '2.0.1', '1.3.4', '1.2.3'].sort(semver.sortVersions)
    ).toEqual(['1.2.3-beta', '1.2.3', '1.3.4', '2.0.1']);
  });
});
