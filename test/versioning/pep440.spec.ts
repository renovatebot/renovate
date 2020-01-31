import pep440 from '../../lib/versioning/pep440';
import { getNewValueTestSuite, NewValueTestConfig } from './common';

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

function generateOtherRangeStrategies(
  testConfigs: NewValueTestConfig[]
): NewValueTestConfig[] {
  const result: NewValueTestConfig[] = [];
  for (const testConfig of testConfigs) {
    result.push(testConfig);
    if (testConfig.rangeStrategy === 'bump') {
      const {
        currentValue,
        fromVersion,
        toVersion,
        expectedValue,
      } = testConfig;

      const needReplace = pep440.matches('1.2.3', currentValue);
      const expectedReplace = needReplace ? currentValue : expectedValue;
      const replace: NewValueTestConfig = {
        currentValue,
        rangeStrategy: 'replace',
        fromVersion,
        toVersion,
        expectedValue: expectedReplace,
      };
      result.push(replace);

      const expectedPin = `==${toVersion}`;
      const pin: NewValueTestConfig = {
        currentValue,
        rangeStrategy: 'pin',
        fromVersion,
        toVersion,
        expectedValue: expectedPin,
      };
      result.push(pin);
    }
  }
  return result;
}

export const getNewValueTestCases: NewValueTestConfig[] = generateOtherRangeStrategies(
  [
    // simple cases
    {
      currentValue: '==1.0.3',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
      expectedValue: '==1.2.3',
    },
    {
      currentValue: '>=1.2.0',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
      expectedValue: '>=1.2.3',
    },
    {
      currentValue: '~=1.2.0',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
      expectedValue: '~=1.2.3',
    },
    {
      currentValue: '~=1.0.3',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
      expectedValue: '~=1.2.3',
    },

    // glob
    {
      currentValue: '==1.2.*',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
      expectedValue: '==1.2.*',
    },
    {
      currentValue: '==1.0.*',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
      expectedValue: '==1.2.*',
    },

    // future versions guard
    {
      currentValue: '<1.2.2.3',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
      expectedValue: '<1.2.4.0',
    },
    {
      currentValue: '<1.2.3',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
      expectedValue: '<1.2.4',
    },
    {
      currentValue: '<1.2',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
      expectedValue: '<1.3',
    },
    {
      currentValue: '<1',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
      expectedValue: '<2',
    },
    {
      currentValue: '<2.0.0',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
      expectedValue: '<2.0.0',
    },

    // minimum version guard
    {
      currentValue: '>0.9.8',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
      expectedValue: '>0.9.8',
    },
    // rollback
    {
      currentValue: '>2.0.0',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
      expectedValue: '>=1.2.3',
    },
    {
      currentValue: '>=2.0.0',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
      expectedValue: '>=1.2.3',
    },

    // complex ranges
    {
      currentValue: '~=1.1.0, !=1.1.1',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
      expectedValue: '~=1.2.3, !=1.1.1',
    },
    {
      currentValue: '~=1.1.0,!=1.1.1',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
      expectedValue: '~=1.2.3,!=1.1.1',
    },

    // invalid & not supported
    {
      currentValue: ' ',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
      expectedValue: ' ',
    },
    {
      currentValue: 'invalid',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
      expectedValue: null,
    },
    {
      currentValue: '===1.0.3',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
      expectedValue: null,
    },

    // impossible
    {
      currentValue: '!=1.2.3',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
      expectedValue: null,
    },
  ]
);

describe.each(getNewValueTestCases)(
  'pep440.getNewValue()',
  getNewValueTestSuite(pep440.getNewValue)
);
