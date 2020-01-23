import pep440 from '../../lib/versioning/pep440';
import { api as semver } from '../../lib/versioning/poetry';

describe('pep440.isValid(input)', () => {
  test.each([
    '==1.2.3',
    '0.2',
    '1.1.0',
    '1.0a1',
    '1.0b2',
    '1.0rc1',
    '1.0.dev4',
    '1.0c1',
    '2012.2',
    '1.0.dev456',
    '1.0a1',
    '1.0a2.dev456',
    '1.0a12.dev456',
    '1.0a12',
    '1.0b1.dev456',
    '1.0b2',
    '1.0b2.post345.dev456',
    '1.0b2.post345',
    '1.0rc1.dev456',
    '1.0rc1',
    '1.0',
    '1.0+abc.5',
    '1.0+abc.7',
    '1.0+5',
    '1.0.post456.dev34',
    '1.0.post456',
    '1.1.dev1',
    '~=3.1', // version 3.1 or later, but not version 4.0 or later.
    '~=3.1.2', // version 3.1.2 or later, but not version 3.2.0 or later.
    '~=3.1a1', // version 3.1a1 or later, but not version 4.0 or later.
    '==3.1', // specifically version 3.1 (or 3.1.0), excludes all pre-releases, post releases, developmental releases and any 3.1.x maintenance releases.
    '==3.1.*', // any version that starts with 3.1. Equivalent to the ~=3.1.0 compatible release clause.
    '~=3.1.0, !=3.1.3', // version 3.1.0 or later, but not version 3.1.3 and not version 3.2.0 or later.
    '<=2.0',
    '<2.0',
  ])('%s', input => {
    expect(semver.isValid(input)).toBeTruthy();
  });
  it('should support pep440 with RC', () => {
    expect(pep440.isValid('==1.2.3rc0')).toBeTruthy();
  });
  it('should support ranges', () => {
    expect(pep440.isValid('~=1.2.3')).toBeTruthy();
    expect(pep440.isValid('==1.2.*')).toBeTruthy();
    expect(pep440.isValid('>1.2.3')).toBeTruthy();
  });
  it('should reject github repositories', () => {
    expect(pep440.isValid('renovatebot/renovate')).toBeFalsy();
    expect(pep440.isValid('renovatebot/renovate#master')).toBeFalsy();
    expect(
      pep440.isValid('https://github.com/renovatebot/renovate.git')
    ).toBeFalsy();
  });
});

describe('pep440.isStable(version)', () => {
  it('returns correct value', () => {
    expect(pep440.isStable('1.2.3')).toBeTruthy();
    expect(pep440.isStable('1.2.3rc0')).toBeFalsy();
  });
  it('returns false when version invalid', () => {
    expect(pep440.isStable('not_version')).toBeFalsy();
  });
});

describe('pep440.isSingleVersion()', () => {
  it('returns true if naked version', () => {
    expect(pep440.isSingleVersion('1.2.3')).toBeTruthy();
    expect(pep440.isSingleVersion('1.2.3rc0')).toBeTruthy();
  });
  it('returns true if double equals', () => {
    expect(pep440.isSingleVersion('==1.2.3')).toBeTruthy();
    expect(pep440.isSingleVersion('==1.2')).toBeTruthy();
    expect(pep440.isSingleVersion('== 1.2.3')).toBeTruthy();
  });
  it('returns false when not version', () => {
    expect(pep440.isSingleVersion('==1.*')).toBeFalsy();
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
    expect(pep440.maxSatisfyingVersion(versions, '~=2.1')).toBeNull();
  });
});

describe('pep440.minSatisfyingVersion(versions, range)', () => {
  it('returns correct value', () => {
    expect(pep440.minSatisfyingVersion(versions, '~=1.2.1')).toBe('1.2.1');
  });
  it('returns null when none found', () => {
    expect(pep440.minSatisfyingVersion(versions, '~=2.1')).toBeNull();
  });
});

describe('pep440.getNewValue()', () => {
  const { getNewValue } = pep440;

  // cases: [currentValue, expectedBump]
  [
    // simple cases
    ['==1.0.3', '==1.2.3'],
    ['>=1.2.0', '>=1.2.3'],
    ['~=1.2.0', '~=1.2.3'],
    ['~=1.0.3', '~=1.2.3'],

    // glob
    ['==1.2.*', '==1.2.*'],
    ['==1.0.*', '==1.2.*'],

    // future versions guard
    ['<1.2.2.3', '<1.2.4.0'],
    ['<1.2.3', '<1.2.4'],
    ['<1.2', '<1.3'],
    ['<1', '<2'],
    ['<2.0.0', '<2.0.0'],

    // minimum version guard
    ['>0.9.8', '>0.9.8'],
    // rollback
    ['>2.0.0', '>=1.2.3'],
    ['>=2.0.0', '>=1.2.3'],

    // complex ranges
    ['~=1.1.0, !=1.1.1', '~=1.2.3, !=1.1.1'],
    ['~=1.1.0,!=1.1.1', '~=1.2.3,!=1.1.1'],

    // invalid & not supported
    [' ', ' '],
    ['invalid', null],
    ['===1.0.3', null],
    // impossible
    ['!=1.2.3', null],
  ].forEach(([currentValue, expectedBump]) => {
    const bumped = getNewValue({
      currentValue,
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
    });
    it(`bumps '${currentValue}' to '${expectedBump}'`, () => {
      expect(bumped).toBe(expectedBump);
    });

    const replaced = getNewValue({
      currentValue,
      rangeStrategy: 'replace',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
    });
    const needReplace = pep440.matches('1.2.3', currentValue);
    const expectedReplace = needReplace ? currentValue : bumped;
    it(`replaces '${currentValue}' to '${expectedReplace}'`, () => {
      expect(replaced).toBe(expectedReplace);
    });

    const pinned = getNewValue({
      currentValue,
      rangeStrategy: 'pin',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
    });
    const expectedPin = '==1.2.3';
    it(`pins '${currentValue}' to '${expectedPin}'`, () => {
      expect(pinned).toBe(expectedPin);
    });
  });

  it('guards against unsupported rangeStrategy', () => {
    const invalid = getNewValue({
      currentValue: '==1.0.0',
      rangeStrategy: 'update-lockfile',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
    });
    expect(invalid).toEqual('==1.2.3');
  });
});
