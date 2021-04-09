import pep440 from '.';

describe('pep440.isValid(input)', () => {
  it('should support a version without equals', () => {
    expect(pep440.isValid('0.750')).toBeTruthy();
    expect(pep440.isValid('1.2.3')).toBeTruthy();
    expect(pep440.isValid('1.9')).toBeTruthy();
  });
  it('should support irregular versions', () => {
    expect(pep440.isValid('17.04.0')).toBeTruthy();
  });
  it('should support simple pep440', () => {
    expect(pep440.isValid('==1.2.3')).toBeTruthy();
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

describe('pep440.equals(version1, version2)', () => {
  it('returns correct true', () => {
    expect(pep440.equals('1.0', '1.0.0')).toBeTruthy();
  });
  it('returns false when version invalid', () => {
    expect(pep440.equals('1.0.0', '1.0..foo')).toBeFalsy();
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

describe('pep440.getSatisfyingVersion(versions, range)', () => {
  it('returns correct value', () => {
    expect(pep440.getSatisfyingVersion(versions, '~=1.2.1')).toBe('1.2.3');
  });
  it('returns null when none found', () => {
    expect(pep440.getSatisfyingVersion(versions, '~=2.1')).toBeNull();
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
    // plain version
    ['1.0.0', '1.2.3'],

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
      currentVersion: '1.0.0',
      newVersion: '1.2.3',
    });
    it(`bumps '${currentValue}' to '${expectedBump}'`, () => {
      expect(bumped).toBe(expectedBump);
    });

    const replaced = getNewValue({
      currentValue,
      rangeStrategy: 'replace',
      currentVersion: '1.0.0',
      newVersion: '1.2.3',
    });
    const needReplace = pep440.matches('1.2.3', currentValue);
    const expectedReplace = needReplace ? currentValue : bumped;
    it(`replaces '${currentValue}' to '${expectedReplace}'`, () => {
      expect(replaced).toBe(expectedReplace);
    });

    const pinned = getNewValue({
      currentValue,
      rangeStrategy: 'pin',
      currentVersion: '1.0.0',
      newVersion: '1.2.3',
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
      currentVersion: '1.0.0',
      newVersion: '1.2.3',
    });
    expect(invalid).toEqual('==1.2.3');
  });
});
