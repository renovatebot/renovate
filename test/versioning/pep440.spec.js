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

describe('pep440.getMinor(input)', () => {
  it('returns correct value', () => {
    expect(pep440.getMinor('1.2.3')).toBe(2);
  });
  it('pads zeros', () => {
    expect(pep440.getMinor('1')).toBe(0);
  });
  it('throws when version invalid', () => {
    expect(() => pep440.getMinor('not_version')).toThrowError(TypeError);
  });
});

describe('pep440.getMajor(version)', () => {
  it('returns correct value', () => {
    expect(pep440.getMajor('1.2.3')).toBe(1);
  });
  it('handles epoch', () => {
    expect(pep440.getMajor('25!1.2.3')).toBe(1);
  });
  it('throws when version invalid', () => {
    expect(() => pep440.getMajor('not_version')).toThrowError(TypeError);
  });
});

describe('pep440.getMajor(version)', () => {
  it('returns correct value', () => {
    expect(pep440.getMajor('1.2.3')).toBe(1);
  });
  it('handles epoch', () => {
    expect(pep440.getMajor('25!1.2.3')).toBe(1);
  });
  it('throws when version invalid', () => {
    expect(() => pep440.getMajor('not_version')).toThrowError(TypeError);
  });
});

describe('pep440.isStable(version)', () => {
  it('returns correct value', () => {
    expect(pep440.isStable('1.2.3')).toBe(true);
    expect(pep440.isStable('1.2.3rc0')).toBe(false);
  });
  it('returns false when version invalid', () => {
    expect(pep440.isStable('not_version')).toBe(false);
  });
});

const versions = [
  '0.9.4',
  '1.0.0',
  '1.1.5',
  '1.2.1',
  '1.2.2',
  '1.2.3',
  '1.3.4',
  '2.0.3',
];

describe('pep440.maxSatisfyingVersion(versions, range)', () => {
  it('returns correct value', () => {
    expect(pep440.maxSatisfyingVersion(versions, '~=1.2.1')).toBe('1.2.3');
  });
  it('returns null when none found', () => {
    expect(pep440.maxSatisfyingVersion(versions, '~=2.1')).toBe(null);
  });
});

describe('pep440.minSatisfyingVersion(versions, range)', () => {
  it('returns correct value', () => {
    expect(pep440.minSatisfyingVersion(versions, '~=1.2.1')).toBe('1.2.1');
  });
  it('returns null when none found', () => {
    expect(pep440.minSatisfyingVersion(versions, '~=2.1')).toBe(null);
  });
});
