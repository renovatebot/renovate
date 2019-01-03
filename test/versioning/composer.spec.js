const semver = require('../../lib/versioning/composer');

describe('semver.getPatch(input)', () => {
  it('gets patch', () => {
    expect(semver.getPatch('1.2.0')).toEqual(0);
  });
});
describe('semver.equals(a, b)', () => {
  it('should pad short version', () => {
    expect(semver.equals('1.2.0', 'v1.2')).toBe(true);
  });
  it('should pad really short version', () => {
    expect(semver.equals('v1.0.0', '1')).toBe(true);
  });
});
describe('semver.isGreaterThan(a, b)', () => {
  it('should pad short version', () => {
    expect(semver.isGreaterThan('1.2.0', 'v1.2')).toBe(false);
  });
  it('should pad really short version', () => {
    expect(semver.isGreaterThan('v1.0.1', '1')).toBe(true);
  });
  it('should pad both versions', () => {
    expect(semver.isGreaterThan('1', '1.1')).toBe(false);
  });
});
describe('semver.isSingleVersion(input)', () => {
  it('should pad short version', () => {
    expect(!!semver.isSingleVersion('v1.2')).toBe(true);
  });
});
describe('semver.isStable(input)', () => {
  it('should pad short version', () => {
    expect(!!semver.isStable('v1.2')).toBe(true);
  });
});
describe('semver.isValid(input)', () => {
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
});
describe('semver.isVersion(input)', () => {
  it('should support simple semver', () => {
    expect(!!semver.isValid('1.2.3')).toBe(true);
  });
  it('should support shortened version', () => {
    expect(!!semver.isValid('2.5')).toBe(true);
  });
  it('should support shortened v version', () => {
    expect(!!semver.isValid('v2.5')).toBe(true);
  });
});
describe('semver.isLessThanRange()', () => {
  it('handles massaged tilde', () => {
    expect(semver.isLessThanRange('0.3.1', '~0.4')).toBe(true);
    expect(semver.isLessThanRange('0.5.1', '~0.4')).toBe(false);
  });
});
describe('semver.maxSatisfyingVersion()', () => {
  it('handles massaged tilde', () => {
    expect(
      semver.maxSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '~4'
      )
    ).toBe('4.2.0');
    expect(
      semver.maxSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '~0.4'
      )
    ).toBe('0.5.0');
  });
});
describe('semver.minSatisfyingVersion()', () => {
  it('handles massaged tilde', () => {
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '~4'
      )
    ).toBe('4.0.0');
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '~0.4'
      )
    ).toBe('0.4.0');
  });
});
describe('semver.matches()', () => {
  it('handles massaged tilde', () => {
    expect(semver.matches('0.3.1', '~0.4')).toBe(false);
    expect(semver.matches('0.5.1', '~0.4')).toBe(true);
  });
});
describe('semver.getNewValue()', () => {
  it('returns toVersion', () => {
    expect(semver.getNewValue('v1.0', 'replace', '1.0', '1.1')).toEqual('v1.1');
  });
  it('bumps short caret to same', () => {
    expect(semver.getNewValue('^1.0', 'bump', '1.0.0', '1.0.7')).toEqual(
      '^1.0'
    );
  });
  it('handles tilde zero', () => {
    expect(semver.getNewValue('~0.2', 'replace', '0.2.0', '0.3.0')).toEqual(
      '~0.3'
    );
    expect(semver.getNewValue('~0.2', 'replace', '0.2.0', '1.1.0')).toEqual(
      '~1.0'
    );
  });
  it('handles tilde major', () => {
    expect(semver.getNewValue('~4', 'replace', '4.0.0', '4.2.0')).toEqual('~4');
    expect(semver.getNewValue('~4', 'replace', '4.0.0', '5.1.0')).toEqual('~5');
  });
  it('handles tilde minor', () => {
    expect(semver.getNewValue('~4.0', 'replace', '4.0.0', '5.1.0')).toEqual(
      '~5.0'
    );
    expect(semver.getNewValue('~4.0', 'replace', '4.0.0', '4.1.0')).toEqual(
      '~4.1'
    );
    expect(
      semver.getNewValue('~1.2 || ~2.0', 'replace', '2.0.0', '3.1.0')
    ).toEqual('~3.0');
    expect(
      semver.getNewValue('~1.2 || ~2.0', 'widen', '2.0.0', '3.1.0')
    ).toEqual('~1.2 || ~2.0 || ~3.0');
  });
  it('returns toVersion if unsupported', () => {
    expect(semver.getNewValue('+4.0.0', 'replace', '4.0.0', '4.2.0')).toEqual(
      '4.2.0'
    );
  });
  it('returns versioned toVersion', () => {
    expect(semver.getNewValue('v4.0.0', 'replace', '4.0.0', '4.2.0')).toEqual(
      'v4.2.0'
    );
  });
  it('bumps short caret with v', () => {
    expect(semver.getNewValue('^v1.0', 'bump', '1.0.0', '1.1.7')).toEqual(
      '^v1.1'
    );
  });
  it('handles differing lengths', () => {
    expect(semver.getNewValue('3.6.*', 'replace', '3.6.0', '3.7')).toEqual(
      '3.7.*'
    );
  });
});
