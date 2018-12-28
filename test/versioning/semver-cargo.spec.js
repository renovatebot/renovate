const semver = require('../../lib/versioning/semver-cargo');

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
        ['4.2.1', '0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '3.0, 4.*.0'
      )
    ).toBe('4.2.1');
    expect(
      semver.maxSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '4.0.0, 5.0'
      )
    ).toBe('5.0.0');
  });
});
describe('semver.isValid()', () => {
  it('simple constraints are valid', () => {
    expect(!!semver.isValid('1')).toBe(true);
    expect(!!semver.isValid('1.2')).toBe(true);
    expect(!!semver.isValid('1.2.3')).toBe(true);
    expect(!!semver.isValid('^1.2.3')).toBe(true);
    expect(!!semver.isValid('~1.2.3')).toBe(true);
    expect(!!semver.isValid('1.2.*')).toBe(true);
  });
  it('handles comma', () => {
    expect(!!semver.isValid('< 3.0, >= 1.0.0 <= 2.0.0')).toBe(true);
    expect(!!semver.isValid('< 3.0, >= 1.0.0 <= 2.0.0, = 5.1.2')).toBe(true);
  });
});
describe('semver.isVersion()', () => {
  it('handles comma', () => {
    expect(!!semver.isVersion('1.2.3')).toBe(true);
    expect(!!semver.isValid('1.2')).toBe(true);
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
      semver.minSatisfyingVersion(['0.4.0', '0.5.0', '4.2.0', '5.0.0'], '4.0.0')
    ).toBe('4.2.0');
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '4.0.0, = 0.5.0'
      )
    ).toBe('0.5.0');
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
describe('semver.isSingleVersion()', () => {
  it('returns false if naked version', () => {
    expect(!!semver.isSingleVersion('1.2.3')).toBe(false);
    expect(!!semver.isSingleVersion('1.2.3-alpha.1')).toBe(false);
  });
  it('returns true if equals', () => {
    expect(!!semver.isSingleVersion('=1.2.3')).toBe(true);
    expect(!!semver.isSingleVersion('= 1.2.3')).toBe(true);
    expect(!!semver.isSingleVersion('  = 1.2.3')).toBe(true);
  });
  it('returns false for partial versions', () => {
    expect(!!semver.isSingleVersion('1')).toBe(false);
    expect(!!semver.isSingleVersion('1.2')).toBe(false);
  });
  it('returns false for wildcard constraints', () => {
    expect(!!semver.isSingleVersion('*')).toBe(false);
    expect(!!semver.isSingleVersion('1.*')).toBe(false);
    expect(!!semver.isSingleVersion('1.2.*')).toBe(false);
  });
});
