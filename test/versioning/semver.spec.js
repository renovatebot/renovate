const semver = require('../../lib/versioning')('semver');

describe('semver.isValid(input)', () => {
  it('should return null for irregular versions', () => {
    expect(!!semver.isValid('17.04.0')).toBe(false);
  });
  it('should support simple semver', () => {
    expect(!!semver.isValid('1.2.3')).toBe(true);
  });
  it('should support semver with dash', () => {
    expect(!!semver.isValid('1.2.3-foo')).toBe(true);
  });
  it('should reject semver without dash', () => {
    expect(!!semver.isValid('1.2.3foo')).toBe(false);
  });
  it('should support ranges', () => {
    expect(!!semver.isValid('~1.2.3')).toBe(true);
    expect(!!semver.isValid('^1.2.3')).toBe(true);
    expect(!!semver.isValid('>1.2.3')).toBe(true);
  });
  it('should reject github repositories', () => {
    expect(!!semver.isValid('renovateapp/renovate')).toBe(false);
    expect(!!semver.isValid('renovateapp/renovate#master')).toBe(false);
    expect(
      !!semver.isValid('https://github.com/renovateapp/renovate.git')
    ).toBe(false);
  });
});
describe('semver.isRange(input)', () => {
  it('rejects simple semver', () => {
    expect(!!semver.isRange('1.2.3')).toBe(false);
  });
  it('accepts tilde', () => {
    expect(!!semver.isRange('~1.2.3')).toBe(true);
  });
  it('accepts caret', () => {
    expect(!!semver.isRange('^1.2.3')).toBe(true);
  });
});
describe('semver.isSingleVersion()', () => {
  it('returns true if naked version', () => {
    expect(!!semver.isSingleVersion('1.2.3')).toBe(true);
    expect(!!semver.isSingleVersion('1.2.3-alpha.1')).toBe(true);
  });
  it('returns true if equals', () => {
    expect(!!semver.isSingleVersion('=1.2.3')).toBe(true);
    expect(!!semver.isSingleVersion('= 1.2.3')).toBe(true);
  });
  it('returns false when not version', () => {
    expect(!!semver.isSingleVersion('1.x')).toBe(false);
  });
});
describe('semver.getNewValue()', () => {
  it('bumps equals', () => {
    expect(
      semver.getNewValue(
        { currentValue: '=1.0.0', rangeStrategy: 'bump' },
        '1.0.0',
        '1.1.0'
      )
    ).toEqual('=1.1.0');
  });
  it('replaces equals', () => {
    expect(
      semver.getNewValue(
        { currentValue: '=1.0.0', rangeStrategy: 'replace' },
        '1.0.0',
        '1.1.0'
      )
    ).toEqual('=1.1.0');
  });
});
