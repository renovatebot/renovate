const semver = require('../../lib/versioning/cargo');

describe('semver.matches()', () => {
  it('handles comma', () => {
    expect(semver.matches('4.2.0', '4.2, >= 3.0, < 5.0.0')).toBe(true);
    expect(semver.matches('4.2.0', '2.0, >= 3.0, < 5.0.0')).toBe(false);
    expect(semver.matches('4.2.0', '4.2.0, < 4.2.4')).toBe(true);
    expect(semver.matches('4.2.0', '4.3.0, 3.0.0')).toBe(false);
    expect(semver.matches('4.2.0', '> 5.0.0, <= 6.0.0')).toBe(false);
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
describe('semver.isValid()', () => {
  it('simple constraints are valid', () => {
    expect(!!semver.isValid('1')).toBe(true);
    expect(!!semver.isValid('1.2')).toBe(true);
    expect(!!semver.isValid('1.2.3')).toBe(true);
    expect(!!semver.isValid('^1.2.3')).toBe(true);
    expect(!!semver.isValid('~1.2.3')).toBe(true);
    expect(!!semver.isValid('1.2.*')).toBe(true);
  });
  it('handles comma', () => {
    expect(!!semver.isValid('< 3.0, >= 1.0.0 <= 2.0.0')).toBe(true);
    expect(!!semver.isValid('< 3.0, >= 1.0.0 <= 2.0.0, = 5.1.2')).toBe(true);
  });
});
describe('semver.isVersion()', () => {
  it('handles comma', () => {
    expect(!!semver.isVersion('1.2.3')).toBe(true);
    expect(!!semver.isValid('1.2')).toBe(true);
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
      semver.minSatisfyingVersion(['0.4.0', '0.5.0', '4.2.0', '5.0.0'], '4.0.0')
    ).toBe('4.2.0');
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '4.0.0, = 0.5.0'
      )
    ).toBe(null);
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '4.0.0, > 4.1.0, <= 4.3.5'
      )
    ).toBe('4.2.0');
    expect(
      semver.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '6.2.0, 3.*'
      )
    ).toBe(null);
  });
});
describe('semver.isSingleVersion()', () => {
  it('returns false if naked version', () => {
    expect(!!semver.isSingleVersion('1.2.3')).toBe(false);
    expect(!!semver.isSingleVersion('1.2.3-alpha.1')).toBe(false);
  });
  it('returns true if equals', () => {
    expect(!!semver.isSingleVersion('=1.2.3')).toBe(true);
    expect(!!semver.isSingleVersion('= 1.2.3')).toBe(true);
    expect(!!semver.isSingleVersion('  = 1.2.3')).toBe(true);
  });
  it('returns false for partial versions', () => {
    expect(!!semver.isSingleVersion('1')).toBe(false);
    expect(!!semver.isSingleVersion('1.2')).toBe(false);
  });
  it('returns false for wildcard constraints', () => {
    expect(!!semver.isSingleVersion('*')).toBe(false);
    expect(!!semver.isSingleVersion('1.*')).toBe(false);
    expect(!!semver.isSingleVersion('1.2.*')).toBe(false);
  });
});
describe('semver.getNewValue()', () => {
  it('bumps equals', () => {
    expect(semver.getNewValue('=1.0.0', 'bump', '1.0.0', '1.1.0')).toEqual(
      '=1.1.0'
    );
    expect(semver.getNewValue('   =1.0.0', 'bump', '1.0.0', '1.1.0')).toEqual(
      '=1.1.0'
    );
  });
  it('bumps equals space', () => {
    expect(semver.getNewValue('= 1.0.0', 'bump', '1.0.0', '1.1.0')).toEqual(
      '= 1.1.0'
    );
    expect(semver.getNewValue('  = 1.0.0', 'bump', '1.0.0', '1.1.0')).toEqual(
      '=1.1.0'
    );
    expect(semver.getNewValue('  =   1.0.0', 'bump', '1.0.0', '1.1.0')).toEqual(
      '=1.1.0'
    );
    expect(semver.getNewValue('=    1.0.0', 'bump', '1.0.0', '1.1.0')).toEqual(
      '= 1.1.0'
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
  it('replaces with version range', () => {
    expect(semver.getNewValue('1.0.0', 'replace', '1.0.0', '2.0.7')).toEqual(
      '2.0.0'
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
