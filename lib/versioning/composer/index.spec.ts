import { api as semver } from '.';

describe('semver.getPatch(input)', () => {
  it('gets patch', () => {
    expect(semver.getPatch('1.2.0')).toEqual(0);
  });
});
describe('semver.equals(a, b)', () => {
  it('should pad short version', () => {
    expect(semver.equals('1.2.0', 'v1.2')).toBe(true);
  });
  it('should pad really short version', () => {
    expect(semver.equals('v1.0.0', '1')).toBe(true);
  });
  it('should translate stability modifier', () => {
    expect(semver.equals('1.0@alpha3', '1.0.0-alpha.3')).toBe(true);
    expect(semver.equals('1.0@beta', '1.0.0-beta')).toBe(true);
    expect(semver.equals('1.0@rc2', '1.0.0-rc.2')).toBe(true);
  });
});
describe('semver.isGreaterThan(a, b)', () => {
  it('should pad short version', () => {
    expect(semver.isGreaterThan('1.2.0', 'v1.2')).toBe(false);
  });
  it('should pad really short version', () => {
    expect(semver.isGreaterThan('v1.0.1', '1')).toBe(true);
  });
  it('should pad both versions', () => {
    expect(semver.isGreaterThan('1', '1.1')).toBe(false);
  });
});
describe('semver.isSingleVersion(input)', () => {
  it('should pad short version', () => {
    expect(semver.isSingleVersion('v1.2')).toBeTruthy();
  });
});
describe('semver.isStable(input)', () => {
  it('should pad short version', () => {
    expect(semver.isStable('v1.2')).toBeTruthy();
  });
});
describe('semver.isValid(input)', () => {
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
});
describe('semver.isVersion(input)', () => {
  it('should support simple semver', () => {
    expect(semver.isValid('1.2.3')).toBeTruthy();
  });
  it('should support shortened version', () => {
    expect(semver.isValid('2.5')).toBeTruthy();
  });
  it('should support shortened v version', () => {
    expect(semver.isValid('v2.5')).toBeTruthy();
  });
});
describe('semver.isLessThanRange()', () => {
  it('handles massaged tilde', () => {
    expect(semver.isLessThanRange('0.3.1', '~0.4')).toBe(true);
    expect(semver.isLessThanRange('0.5.1', '~0.4')).toBe(false);
  });
});
describe('semver.maxSatisfyingVersion()', () => {
  it('handles massaged tilde', () => {
    expect(
      semver.maxSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '~4'
      )
    ).toBe('4.2.0');
    expect(
      semver.maxSatisfyingVersion(
        ['v0.4.0', 'v0.5.0', 'v4.0.0', 'v4.2.0', 'v5.0.0'],
        '~4'
      )
    ).toBe('4.2.0');
    expect(
      semver.maxSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '~0.4'
      )
    ).toBe('0.5.0');
  });
  it('handles prereleases', () => {
    expect(
      semver.maxSatisfyingVersion(
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
});
describe('semver.minSatisfyingVersion()', () => {
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
});
describe('semver.matches()', () => {
  it('handles massaged tilde', () => {
    expect(semver.matches('0.3.1', '~0.4')).toBe(false);
    expect(semver.matches('0.5.1', '~0.4')).toBe(true);
  });
});
describe('semver.getNewValue()', () => {
  it('returns pinned toVersion', () => {
    expect(
      semver.getNewValue({
        currentValue: '~1.0',
        rangeStrategy: 'pin',
        fromVersion: '1.0',
        toVersion: 'V1.1',
      })
    ).toEqual('V1.1');
    expect(
      semver.getNewValue({
        currentValue: '^1.0',
        rangeStrategy: 'pin',
        fromVersion: '1.0',
        toVersion: 'V1.1',
      })
    ).toEqual('V1.1');
  });
  it('returns toVersion', () => {
    expect(
      semver.getNewValue({
        currentValue: 'v1.0',
        rangeStrategy: 'replace',
        fromVersion: '1.0',
        toVersion: '1.1',
      })
    ).toEqual('v1.1');
  });
  it('bumps short caret to same', () => {
    expect(
      semver.getNewValue({
        currentValue: '^1.0',
        rangeStrategy: 'bump',
        fromVersion: '1.0.0',
        toVersion: '1.0.7',
      })
    ).toEqual('^1.0');
  });
  it('bumps less than to same', () => {
    expect(
      semver.getNewValue({
        currentValue: '<2.7.14',
        rangeStrategy: 'bump',
        fromVersion: '2.0.3',
        toVersion: '2.0.4',
      })
    ).toEqual('<2.7.14');
  });
  it('bumps caret to same', () => {
    expect(
      semver.getNewValue({
        currentValue: '^1.0.0',
        rangeStrategy: 'bump',
        fromVersion: '1.0.0',
        toVersion: '1.3.5',
      })
    ).toEqual('^1.3.5');
  });
  it('replaces caret to same', () => {
    expect(
      semver.getNewValue({
        currentValue: '^1',
        rangeStrategy: 'replace',
        fromVersion: '1.0.0',
        toVersion: '1.3.5',
      })
    ).toEqual('^1');
  });
  it('replaces short caret', () => {
    expect(
      semver.getNewValue({
        currentValue: '^1.0',
        rangeStrategy: 'replace',
        fromVersion: '1.0.0',
        toVersion: '2.3.5',
      })
    ).toEqual('^2.0');
  });
  it('handles tilde zero', () => {
    expect(
      semver.getNewValue({
        currentValue: '~0.2',
        rangeStrategy: 'replace',
        fromVersion: '0.2.0',
        toVersion: '0.3.0',
      })
    ).toEqual('~0.3');
    expect(
      semver.getNewValue({
        currentValue: '~0.2',
        rangeStrategy: 'replace',
        fromVersion: '0.2.0',
        toVersion: '1.1.0',
      })
    ).toEqual('~1.0');
  });
  it('handles tilde major', () => {
    expect(
      semver.getNewValue({
        currentValue: '~4',
        rangeStrategy: 'replace',
        fromVersion: '4.0.0',
        toVersion: '4.2.0',
      })
    ).toEqual('~4');
    expect(
      semver.getNewValue({
        currentValue: '~4',
        rangeStrategy: 'replace',
        fromVersion: '4.0.0',
        toVersion: '5.1.0',
      })
    ).toEqual('~5');
  });
  it('handles tilde minor', () => {
    expect(
      semver.getNewValue({
        currentValue: '~4.0',
        rangeStrategy: 'replace',
        fromVersion: '4.0.0',
        toVersion: '5.1.0',
      })
    ).toEqual('~5.0');
    expect(
      semver.getNewValue({
        currentValue: '~4.0',
        rangeStrategy: 'replace',
        fromVersion: '4.0.0',
        toVersion: '4.1.0',
      })
    ).toEqual('~4.1');
    expect(
      semver.getNewValue({
        currentValue: '~1.2 || ~2.0',
        rangeStrategy: 'replace',
        fromVersion: '2.0.0',
        toVersion: '3.1.0',
      })
    ).toEqual('~3.0');
    expect(
      semver.getNewValue({
        currentValue: '~1.2 || ~2.0',
        rangeStrategy: 'widen',
        fromVersion: '2.0.0',
        toVersion: '3.1.0',
      })
    ).toEqual('~1.2 || ~2.0 || ~3.0');
  });
  it('returns toVersion if unsupported', () => {
    expect(
      semver.getNewValue({
        currentValue: '+4.0.0',
        rangeStrategy: 'replace',
        fromVersion: '4.0.0',
        toVersion: '4.2.0',
      })
    ).toEqual('4.2.0');
  });
  it('returns versioned toVersion', () => {
    expect(
      semver.getNewValue({
        currentValue: 'v4.0.0',
        rangeStrategy: 'replace',
        fromVersion: '4.0.0',
        toVersion: '4.2.0',
      })
    ).toEqual('v4.2.0');
  });
  it('bumps short caret with v', () => {
    expect(
      semver.getNewValue({
        currentValue: '^v1.0',
        rangeStrategy: 'bump',
        fromVersion: '1.0.0',
        toVersion: '1.1.7',
      })
    ).toEqual('^v1.1');
  });
  it('bumps short caret with stability modifiers', () => {
    expect(
      semver.getNewValue({
        currentValue: '^v1.0@beta',
        rangeStrategy: 'bump',
        fromVersion: '1.0.0-beta3',
        toVersion: '1.0.0-beta5',
      })
    ).toEqual('^v1.0.0-beta5@beta');
  });
  it('replaces short caret with stability modifiers', () => {
    expect(
      semver.getNewValue({
        currentValue: '^v1.0@beta',
        rangeStrategy: 'replace',
        fromVersion: '1.0.0-beta3',
        toVersion: '2.0.0-beta5',
      })
    ).toEqual('^v2.0.0-beta5@beta');
  });
  it('preserves the current min-stability modifiers', () => {
    expect(
      semver.getNewValue({
        currentValue: '^4.0@alpha',
        rangeStrategy: 'replace',
        fromVersion: '4.0.0-alpha1',
        toVersion: '4.0.0-beta5',
      })
    ).toEqual('^4.0.0-beta5@alpha');
  });
  it('handles differing lengths', () => {
    expect(
      semver.getNewValue({
        currentValue: '3.6.*',
        rangeStrategy: 'replace',
        fromVersion: '3.6.0',
        toVersion: '3.7',
      })
    ).toEqual('3.7.*');

    expect(
      semver.getNewValue({
        currentValue: 'v3.1.*',
        rangeStrategy: 'replace',
        fromVersion: '3.1.10',
        toVersion: '3.2.0',
      })
    ).toEqual('v3.2.*'); // #5388
  });
});
describe('.sortVersions', () => {
  it('sorts versions in an ascending order', () => {
    expect(
      ['1.2.3-beta', '2.0.1', '1.3.4', '1.2.3'].sort(semver.sortVersions)
    ).toEqual(['1.2.3-beta', '1.2.3', '1.3.4', '2.0.1']);
  });
});
