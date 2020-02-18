import pep440 from '../../lib/versioning/pep440';
import { NewValueTestConfig, MinMaxSatisfyingSampleElem } from './common';

const stableSingle: string[] = [
  '1.2.3',
  '17.04.0',
  '0.2',
  '1.1.0',
  '2012.2',
  '1.0',
  '1.0+abc.5',
  '1.0+abc.7',
  '1.0+5',
  '1.0.post456',
];

const unstableSingle: string[] = [
  '1.2.3rc0',
  '1.0a1',
  '1.0b2',
  '1.0rc1',
  '1.0.dev4',
  '1.0c1',
  '1.0.dev456',
  '1.0a1',
  '1.0a2.dev456',
  '1.0a12.dev456',
  '1.0a12',
  '1.0b1.dev456',
  '1.0b2',
  '1.0b2.post345',
  '1.0rc1.dev456',
  '1.0rc1',
  '1.1.dev1',
  '1.0b2.post345.dev456',
  '1.0.post456.dev34',
];

const singleVersions: string[] = [...stableSingle, ...unstableSingle];

const stableExact: string[] = ['==1.2.3', '== 1.2.3', '==3.1'];

const unstableExact: string[] = ['==1.2.3rc0', '== 1.2.3rc0'];

const exactVersions: string[] = [...stableExact, ...unstableExact];

const invalidInputs: string[] = [
  'renovatebot/renovate',
  'renovatebot/renovate#master',
  'https://github.com/renovatebot/renovate.git',
];

const ranges: string[] = [
  '~=1.2.3',
  '==1.2.*',
  '>1.2.3',
  '~=3.1', // version 3.1 or later, but not version 4.0 or later.
  '~=3.1.2', // version 3.1.2 or later, but not version 3.2.0 or later.
  '~=3.1a1', // version 3.1a1 or later, but not version 4.0 or later.
  '==3.1.*', // any version that starts with 3.1. Equivalent to the ~=3.1.0 compatible release clause.
  '~=3.1.0, !=3.1.3', // version 3.1.0 or later, but not version 3.1.3 and not version 3.2.0 or later.
  '<=2.0',
  '<=2.0',
  '<2.0',
  ' <2.0',
  '< 2.0',
  ' < 2.0',
];

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

const getNewValueTestCases: NewValueTestConfig[] = generateOtherRangeStrategies(
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

    {
      title: 'guards against unsupported rangeStrategy',
      currentValue: '==1.0.0',
      rangeStrategy: 'update-lockfile',
      fromVersion: '1.0.0',
      toVersion: '1.2.3',
      expectedValue: '==1.2.3',
    },
  ]
);

export const sample = {
  stableSingle,
  unstableSingle,
  singleVersions,

  stableExact,
  unstableExact,
  exactVersions,

  invalidInputs,
  ranges,

  minMaxSample,

  getNewValueTestCases,
};
