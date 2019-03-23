const semver = require('../../lib/versioning/semver');

describe('semver.isValid(input)', () => {
  it('should return null for irregular versions', () => {
    expect(Boolean(semver.isValid('17.04.0'))).toBeFalsy();
  });
  it('should support simple semver', () => {
    expect(Boolean(semver.isValid('1.2.3'))).toBeTruthy();
  });
  it('should support semver with dash', () => {
    expect(Boolean(semver.isValid('1.2.3-foo'))).toBeTruthy();
  });
  it('should reject semver without dash', () => {
    expect(Boolean(semver.isValid('1.2.3foo'))).toBeFalsy();
  });
  it('should reject ranges', () => {
    expect(Boolean(semver.isValid('~1.2.3'))).toBeFalsy();
    expect(Boolean(semver.isValid('^1.2.3'))).toBeFalsy();
    expect(Boolean(semver.isValid('>1.2.3'))).toBeFalsy();
  });
  it('should reject github repositories', () => {
    expect(Boolean(semver.isValid('renovatebot/renovate'))).toBeFalsy();
    expect(Boolean(semver.isValid('renovatebot/renovate#master'))).toBeFalsy();
    expect(
      Boolean(semver.isValid('https://github.com/renovatebot/renovate.git'))
    ).toBeFalsy();
  });
});
describe('semver.isSingleVersion()', () => {
  it('returns true if naked version', () => {
    expect(Boolean(semver.isSingleVersion('1.2.3'))).toBeTruthy();
    expect(Boolean(semver.isSingleVersion('1.2.3-alpha.1'))).toBeTruthy();
  });
  it('returns false if equals', () => {
    expect(Boolean(semver.isSingleVersion('=1.2.3'))).toBeFalsy();
    expect(Boolean(semver.isSingleVersion('= 1.2.3'))).toBeFalsy();
  });
  it('returns false when not version', () => {
    expect(Boolean(semver.isSingleVersion('1.x'))).toBeFalsy();
  });
});
describe('semver.getNewValue()', () => {
  it('uses toVersion', () => {
    expect(semver.getNewValue('=1.0.0', 'bump', '1.0.0', '1.1.0')).toEqual(
      '1.1.0'
    );
  });
});
