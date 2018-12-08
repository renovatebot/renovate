const pep440 = require('../../lib/versioning/pep440');

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
    expect(!!pep440.isValid('renovatebot/renovate')).toBe(false);
    expect(!!pep440.isValid('renovatebot/renovate#master')).toBe(false);
    expect(
      !!pep440.isValid('https://github.com/renovatebot/renovate.git')
    ).toBe(false);
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

describe('pep440.isSingleVersion()', () => {
  it('returns true if naked version', () => {
    expect(!!pep440.isSingleVersion('1.2.3')).toBe(true);
    expect(!!pep440.isSingleVersion('1.2.3rc0')).toBe(true);
  });
  it('returns true if double equals', () => {
    expect(!!pep440.isSingleVersion('==1.2.3')).toBe(true);
    expect(!!pep440.isSingleVersion('==1.2')).toBe(true);
    expect(!!pep440.isSingleVersion('== 1.2.3')).toBe(true);
  });
  it('returns false when not version', () => {
    expect(!!pep440.isSingleVersion('==1.*')).toBe(false);
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

    // invalid & not supported
    [' ', ' '],
    ['invalid', null],
    ['===1.0.3', null],
    // impossible
    ['!=1.2.3', null],
  ].forEach(([currentValue, expectedBump]) => {
    const bumped = getNewValue(currentValue, 'bump', '1.0.0', '1.2.3');
    it(`bumps '${currentValue}' to '${expectedBump}'`, () => {
      expect(bumped).toBe(expectedBump);
    });

    const replaced = getNewValue(currentValue, 'replace', '1.0.0', '1.2.3');
    const needReplace = pep440.matches('1.2.3', currentValue);
    const expectedReplace = needReplace ? currentValue : bumped;
    it(`replaces '${currentValue}' to '${expectedReplace}'`, () => {
      expect(replaced).toBe(expectedReplace);
    });

    const pinned = getNewValue(currentValue, 'pin', '1.0.0', '1.2.3');
    const expectedPin = '==1.2.3';
    it(`pins '${currentValue}' to '${expectedPin}'`, () => {
      expect(pinned).toBe(expectedPin);
    });
  });

  it('guards against unsupported rangeStrategy', () => {
    const invalid = getNewValue('==1.2.3', 'invalid', '1.0.0', '1.2.3');
    expect(invalid).toBe(null);
  });
});
