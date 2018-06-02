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
