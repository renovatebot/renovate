const semver = require('../../lib/versioning')('semverCargo');

describe('semver.matches()', () => {
  it('handles comma', () => {
    expect(semver.matches('4.2.0', '2.0, >= 3.0 < 5.0.0')).toBe(true);
    expect(semver.matches('4.2.0', '4.0.0, 3.0.0')).toBe(true);
    expect(semver.matches('4.2.0', '4.3.0, 3.0.0')).toBe(false);
    expect(semver.matches('4.2.0', '4.3.0, 3.0.0, > 5.0.0 <= 6.0.0')).toBe(
      false
    );
  });
});
describe('semver.maxSatisfyingVersion()', () => {
  it('handles comma', () => {
    expect(
      semver.maxSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '3.0, 4.*.0'
      )
    ).toBe('4.2.0');
    expect(
      semver.maxSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '4.0.0, 5.0'
      )
    ).toBe('5.0.0');
  });
});
describe('semver.isValid()', () => {
  it('handles comma', () => {
    expect(semver.isValid('< 3.0, >= 1.0.0 <= 2.0.0')).toBeTruthy();
    expect(semver.isValid('< 3.0, >= 1.0.0 <= 2.0.0')).toBeTruthy();
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
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '4.*, 5.0'
      )
    ).toBe('4.2.0');
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '4.0.0, 4.2'
      )
    ).toBe('4.2.0');
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '4.0.0, 3.*'
      )
    ).toBe('4.2.0');
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '6.2.0, 3.*'
      )
    ).toBe(null);
  });
});
