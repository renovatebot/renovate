const semver = require('../../lib/util/semver');

describe('.isValidSemver(input)', () => {
  it('should support simple semver', () => {
    expect(!!semver.isValidSemver('1.2.3')).toBe(true);
  });
  it('should support semver with dash', () => {
    expect(!!semver.isValidSemver('1.2.3-foo')).toBe(true);
  });
  it('should reject semver without dash', () => {
    expect(!!semver.isValidSemver('1.2.3foo')).toBe(false);
  });
  it('should support ranges', () => {
    expect(!!semver.isValidSemver('~1.2.3')).toBe(true);
    expect(!!semver.isValidSemver('^1.2.3')).toBe(true);
    expect(!!semver.isValidSemver('>1.2.3')).toBe(true);
  });
  it('should reject github repositories', () => {
    expect(!!semver.isValidSemver('renovateapp/renovate')).toBe(false);
    expect(!!semver.isValidSemver('renovateapp/renovate#master')).toBe(false);
    expect(
      !!semver.isValidSemver('https://github.com/renovateapp/renovate.git')
    ).toBe(false);
  });
});
describe('.isRange(input)', () => {
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
