import semver from '.';

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
  it('should reject ranges', () => {
    expect(semver.isValid('~1.2.3')).toBeFalsy();
    expect(semver.isValid('^1.2.3')).toBeFalsy();
    expect(semver.isValid('>1.2.3')).toBeFalsy();
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
  it('returns false if equals', () => {
    expect(semver.isSingleVersion('=1.2.3')).toBeFalsy();
    expect(semver.isSingleVersion('= 1.2.3')).toBeFalsy();
  });
  it('returns false when not version', () => {
    expect(semver.isSingleVersion('1.x')).toBeFalsy();
  });
});
describe('semver.getNewValue()', () => {
  it('uses newVersion', () => {
    expect(
      semver.getNewValue({
        currentValue: '=1.0.0',
        rangeStrategy: 'bump',
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      })
    ).toEqual('1.1.0');
  });
});
