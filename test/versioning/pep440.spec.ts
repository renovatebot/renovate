import pep440 from '../../lib/versioning/pep440';

const stableSingle: string[] = ['1.2.3', '17.04.0'];

const unstableSingle: string[] = ['1.2.3rc0'];

const singleVersions: string[] = [...stableSingle, ...unstableSingle];

const stableExact: string[] = ['==1.2.3', '== 1.2.3'];

const unstableExact: string[] = ['==1.2.3rc0', '== 1.2.3rc0'];

const exactVersions: string[] = [...stableExact, ...unstableExact];

const invalidInputs: string[] = [
  'renovatebot/renovate',
  'renovatebot/renovate#master',
  'https://github.com/renovatebot/renovate.git',
];

const ranges: string[] = ['~=1.2.3', '==1.2.*', '>1.2.3'];

export const sample = {
  stableSingle,
  unstableSingle,
  singleVersions,

  stableExact,
  unstableExact,
  exactVersions,

  invalidInputs,
  ranges,
};

test.each([...sample.exactVersions, ...sample.ranges])(
  'isValid( "%s" ) == true',
  input => {
    expect(pep440.isValid(input)).toBeTruthy();
  }
);
test.each(sample.invalidInputs)('isValid( "%s" ) == false', input => {
  expect(pep440.isValid(input)).toBeFalsy();
});

test.each([...sample.stableSingle])('isStable( "%s" ) == true', input => {
  expect(pep440.isStable(input)).toBeTruthy();
});
test.each([
  ...sample.unstableSingle,
  ...sample.unstableExact,
  ...sample.stableExact, // ??
])('isStable( "%s" ) == false', input => {
  expect(pep440.isStable(input)).toBeFalsy();
});

test.each([...singleVersions, ...exactVersions])(
  'isSingleVersion( "%s" ) == true',
  input => {
    expect(pep440.isSingleVersion(input)).toBeTruthy();
  }
);
test.each([...invalidInputs, ...ranges])(
  'isSingleVersion( "%s" ) == false',
  input => {
    expect(pep440.isSingleVersion(input)).toBeFalsy();
  }
);

const versions: string[] = [
  '0.9.4',
  '1.0.0',
  '1.1.5',
  '1.2.1',
  '1.2.2',
  '1.2.3',
  '1.3.4',
  '2.0.3',
];

interface MinMaxSatisfyingSampleElem {
  versionList: string[];
  range: string;
  min: string | null;
  max: string | null;
}

const minMaxSample: MinMaxSatisfyingSampleElem[] = [
  {
    versionList: versions,
    range: '~=1.2.1',
    min: '1.2.1',
    max: '1.2.3',
  },
  {
    versionList: versions,
    range: '~=2.1',
    min: null,
    max: null,
  },
];

describe.each(minMaxSample)('Satisfying versions', sampleElem => {
  const { versionList, range, min, max } = sampleElem;
  it(`${range} => ${min} ... ${max}`, () => {
    expect(pep440.minSatisfyingVersion(versionList, range)).toBe(min);
    expect(pep440.maxSatisfyingVersion(versionList, range)).toBe(max);
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
