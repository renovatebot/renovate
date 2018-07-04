const semver = require('../../lib/versioning')('semverComposer');

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
    expect(semver.getNewValue('~4.0', 'replace', '4.0.0', '4.2.0')).toEqual(
      '~4.2'
    );
    expect(semver.getNewValue('~4.0', 'replace', '4.0.0', '5.1.0')).toEqual(
      '~5.1'
    );
  });
  it('returns toVersion if unsupported', () => {
    expect(semver.getNewValue('+4.0.0', 'replace', '4.0.0', '4.2.0')).toEqual(
      '4.2.0'
    );
  });
});
