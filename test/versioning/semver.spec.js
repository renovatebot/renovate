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
    expect(!!semver.isValid('renovatebot/renovate')).toBe(false);
    expect(!!semver.isValid('renovatebot/renovate#master')).toBe(false);
    expect(
      !!semver.isValid('https://github.com/renovatebot/renovate.git')
    ).toBe(false);
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
    expect(semver.getNewValue('=1.0.0', 'bump', '1.0.0', '1.1.0')).toEqual(
      '=1.1.0'
    );
  });
  it('bumps short caret to same', () => {
    expect(semver.getNewValue('^1.0', 'bump', '1.0.0', '1.0.7')).toEqual(
      '^1.0'
    );
  });
  it('bumps short caret to new', () => {
    expect(semver.getNewValue('^1.0', 'bump', '1.0.0', '1.1.7')).toEqual(
      '^1.1'
    );
  });
  it('bumps short tilde', () => {
    expect(semver.getNewValue('~1.0', 'bump', '1.0.0', '1.1.7')).toEqual(
      '~1.1'
    );
  });
  it('updates naked caret', () => {
    expect(semver.getNewValue('^1', 'bump', '1.0.0', '2.1.7')).toEqual('^2');
  });
  it('bumps naked tilde', () => {
    expect(semver.getNewValue('~1', 'bump', '1.0.0', '1.1.7')).toEqual('~1');
  });
  it('replaces equals', () => {
    expect(semver.getNewValue('=1.0.0', 'replace', '1.0.0', '1.1.0')).toEqual(
      '=1.1.0'
    );
  });
  it('handles long asterisk', () => {
    expect(semver.getNewValue('1.0.*', 'replace', '1.0.0', '1.1.0')).toEqual(
      '1.1.*'
    );
  });
  it('handles short asterisk', () => {
    expect(semver.getNewValue('1.*', 'replace', '1.0.0', '2.1.0')).toEqual(
      '2.*'
    );
  });
});
