const semver = require('../../lib/versioning/poetry');

describe('semver.isValid(input)', () => {
  it('should return null for irregular versions', () => {
    expect(Boolean(semver.isValid('17.04.0'))).toBe(false);
  });
  it('should support simple semver', () => {
    expect(Boolean(semver.isValid('1.2.3'))).toBe(true);
  });
  it('should support semver with dash', () => {
    expect(Boolean(semver.isValid('1.2.3-foo'))).toBe(true);
  });
  it('should reject semver without dash', () => {
    expect(Boolean(semver.isValid('1.2.3foo'))).toBe(false);
  });
  it('should support ranges', () => {
    expect(Boolean(semver.isValid('~1.2.3'))).toBe(true);
    expect(Boolean(semver.isValid('^1.2.3'))).toBe(true);
    expect(Boolean(semver.isValid('>1.2.3'))).toBe(true);
  });
  it('should reject github repositories', () => {
    expect(Boolean(semver.isValid('renovatebot/renovate'))).toBe(false);
    expect(Boolean(semver.isValid('renovatebot/renovate#master'))).toBe(false);
    expect(
      Boolean(semver.isValid('https://github.com/renovatebot/renovate.git'))
    ).toBe(false);
  });
});
describe('semver.isSingleVersion()', () => {
  it('returns true if naked version', () => {
    expect(Boolean(semver.isSingleVersion('1.2.3'))).toBe(true);
    expect(Boolean(semver.isSingleVersion('1.2.3-alpha.1'))).toBe(true);
  });
  it('returns true if equals', () => {
    expect(Boolean(semver.isSingleVersion('=1.2.3'))).toBe(true);
    expect(Boolean(semver.isSingleVersion('= 1.2.3'))).toBe(true);
  });
  it('returns false when not version', () => {
    expect(Boolean(semver.isSingleVersion('1.*'))).toBe(false);
  });
});
describe('semver.matches()', () => {
  it('handles comma', () => {
    expect(semver.matches('4.2.0', '4.2, >= 3.0, < 5.0.0')).toBe(true);
    expect(semver.matches('4.2.0', '2.0, >= 3.0, < 5.0.0')).toBe(false);
    expect(semver.matches('4.2.2', '4.2.0, < 4.2.4')).toBe(false);
    expect(semver.matches('4.2.2', '^4.2.0, < 4.2.4')).toBe(true);
    expect(semver.matches('4.2.0', '4.3.0, 3.0.0')).toBe(false);
    expect(semver.matches('4.2.0', '> 5.0.0, <= 6.0.0')).toBe(false);
  });
});
describe('semver.isLessThanRange()', () => {
  it('handles comma', () => {
    expect(semver.isLessThanRange('0.9.0', '>= 1.0.0 <= 2.0.0')).toBe(true);
    expect(semver.isLessThanRange('1.9.0', '>= 1.0.0 <= 2.0.0')).toBe(false);
  });
});
describe('semver.minSatisfyingVersion()', () => {
  it('handles comma', () => {
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '4.3.0', '5.0.0'],
        '4.*, > 4.2'
      )
    ).toBe('4.3.0');
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '^4.0.0'
      )
    ).toBe('4.2.0');
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '^4.0.0, = 0.5.0'
      )
    ).toBeNull();
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '^4.0.0, > 4.1.0, <= 4.3.5'
      )
    ).toBe('4.2.0');
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '^6.2.0, 3.*'
      )
    ).toBeNull();
  });
});
describe('semver.maxSatisfyingVersion()', () => {
  it('handles comma', () => {
    expect(
      semver.maxSatisfyingVersion(
        ['4.2.1', '0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '4.*.0, < 4.2.5'
      )
    ).toBe('4.2.1');
    expect(
      semver.maxSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0', '5.0.3'],
        '5.0, > 5.0.0'
      )
    ).toBe('5.0.3');
  });
});

describe('semver.getNewValue()', () => {
  it('bumps exact', () => {
    expect(semver.getNewValue('1.0.0', 'bump', '1.0.0', '1.1.0')).toEqual(
      '1.1.0'
    );
    expect(semver.getNewValue('   1.0.0', 'bump', '1.0.0', '1.1.0')).toEqual(
      '1.1.0'
    );
  });
  it('bumps equals', () => {
    expect(semver.getNewValue('=1.0.0', 'bump', '1.0.0', '1.1.0')).toEqual(
      '=1.1.0'
    );
    expect(semver.getNewValue('=  1.0.0', 'bump', '1.0.0', '1.1.0')).toEqual(
      '=1.1.0'
    );
  });
  it('bumps equals space', () => {
    expect(semver.getNewValue('= 1.0.0', 'bump', '1.0.0', '1.1.0')).toEqual(
      '=1.1.0'
    );
    expect(semver.getNewValue('  = 1.0.0', 'bump', '1.0.0', '1.1.0')).toEqual(
      '=1.1.0'
    );
    expect(semver.getNewValue('  =   1.0.0', 'bump', '1.0.0', '1.1.0')).toEqual(
      '=1.1.0'
    );
    expect(semver.getNewValue('=    1.0.0', 'bump', '1.0.0', '1.1.0')).toEqual(
      '=1.1.0'
    );
  });
  it('bumps version range', () => {
    expect(semver.getNewValue('1.0.0', 'bump', '1.0.0', '1.1.0')).toEqual(
      '1.1.0'
    );
  });
  it('bumps short caret to same', () => {
    expect(semver.getNewValue('^1.0', 'bump', '1.0.0', '1.0.7')).toEqual(
      '^1.0'
    );
  });
  it('replaces with newer', () => {
    expect(semver.getNewValue('^1.0.0', 'replace', '1.0.0', '2.0.7')).toEqual(
      '^2.0.0'
    );
  });
  it('replaces naked version', () => {
    expect(semver.getNewValue('1.0.0', 'replace', '1.0.0', '2.0.7')).toEqual(
      '2.0.7'
    );
  });
  it('replaces with version range', () => {
    expect(semver.getNewValue('1.0.0', 'replace', '1.0.0', '^2.0.7')).toEqual(
      '^2.0.7'
    );
  });
  it('updates naked caret', () => {
    expect(semver.getNewValue('^1', 'bump', '1.0.0', '2.1.7')).toEqual('^2');
  });
  it('bumps naked tilde', () => {
    expect(semver.getNewValue('~1', 'bump', '1.0.0', '1.1.7')).toEqual('~1');
  });
  it('bumps naked major', () => {
    expect(semver.getNewValue('5', 'bump', '5.0.0', '5.1.7')).toEqual('5');
    expect(semver.getNewValue('5', 'bump', '5.0.0', '6.1.7')).toEqual('6');
  });
  it('bumps naked minor', () => {
    expect(semver.getNewValue('5.0', 'bump', '5.0.0', '5.0.7')).toEqual('5.0');
    expect(semver.getNewValue('5.0', 'bump', '5.0.0', '5.1.7')).toEqual('5.1');
    expect(semver.getNewValue('5.0', 'bump', '5.0.0', '6.1.7')).toEqual('6.1');
  });
  it('replaces minor', () => {
    expect(semver.getNewValue('5.0', 'replace', '5.0.0', '6.1.7')).toEqual(
      '6.1'
    );
  });
  it('replaces equals', () => {
    expect(semver.getNewValue('=1.0.0', 'replace', '1.0.0', '1.1.0')).toEqual(
      '=1.1.0'
    );
  });
  it('bumps caret to prerelease', () => {
    expect(
      semver.getNewValue('^1', 'bump', '1.0.0', '1.0.7-prerelease.1')
    ).toEqual('^1.0.7-prerelease.1');
  });
  it('replaces with newer', () => {
    expect(semver.getNewValue('^1.0.0', 'replace', '1.0.0', '1.0.7')).toEqual(
      '^1.0.7'
    );
  });
  it('bumps short tilde', () => {
    expect(semver.getNewValue('~1.0', 'bump', '1.0.0', '1.1.7')).toEqual(
      '~1.1'
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
  it('handles updating from stable to unstable', () => {
    expect(
      semver.getNewValue('~0.6.1', 'replace', '0.6.8', '0.7.0-rc.2')
    ).toEqual('~0.7.0-rc');
  });
  it('handles less than version requirements', () => {
    expect(semver.getNewValue('<1.3.4', 'replace', '1.2.3', '1.5.0')).toEqual(
      '<1.5.1'
    );
    expect(semver.getNewValue('< 1.3.4', 'replace', '1.2.3', '1.5.0')).toEqual(
      '< 1.5.1'
    );
    expect(
      semver.getNewValue('<   1.3.4', 'replace', '1.2.3', '1.5.0')
    ).toEqual('< 1.5.1');
  });
  it('handles less than equals version requirements', () => {
    expect(semver.getNewValue('<=1.3.4', 'replace', '1.2.3', '1.5.0')).toEqual(
      '<=1.5.0'
    );
    expect(semver.getNewValue('<= 1.3.4', 'replace', '1.2.3', '1.5.0')).toEqual(
      '<= 1.5.0'
    );
    expect(
      semver.getNewValue('<=   1.3.4', 'replace', '1.2.3', '1.5.0')
    ).toEqual('<= 1.5.0');
  });
});
