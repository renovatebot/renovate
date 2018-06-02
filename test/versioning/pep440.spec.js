const pep440 = require('../../lib/versioning')('pep440');

describe('pep440.isValid(input)', () => {
  it('should return null for irregular versions', () => {
    expect(!!pep440.isValid('17.04.0')).toBe(false);
  });
  it('should support simple pep440', () => {
    expect(!!pep440.isValid('==1.2.3')).toBe(true);
  });
  it('should support pep440 with RC', () => {
    expect(!!pep440.isValid('==1.2.3rc0')).toBe(true);
  });
  it('should support ranges', () => {
    expect(!!pep440.isValid('~=1.2.3')).toBe(true);
    expect(!!pep440.isValid('==1.2.*')).toBe(true);
    expect(!!pep440.isValid('>1.2.3')).toBe(true);
  });
  it('should reject github repositories', () => {
    expect(!!pep440.isValid('renovateapp/renovate')).toBe(false);
    expect(!!pep440.isValid('renovateapp/renovate#master')).toBe(false);
    expect(
      !!pep440.isValid('https://github.com/renovateapp/renovate.git')
    ).toBe(false);
  });
});
describe('pep440.isRange(input)', () => {
  it('rejects simple pep440', () => {
    expect(!!pep440.isRange('1.2.3')).toBe(false);
  });
  it('accepts tilde', () => {
    expect(!!pep440.isRange('~=1.2.3')).toBe(true);
  });
  it('accepts glob', () => {
    expect(!!pep440.isRange('==1.2.*')).toBe(true);
  });
});
