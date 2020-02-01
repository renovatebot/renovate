import { api as poetry } from '../../lib/versioning/poetry';
import { getNewValueTestSuite, NewValueTestConfig } from './common';
import { sample } from './poetry.data';

describe('isValid', () => {
  const goodSample = [
    ...sample.singleVersions,
    ...sample.exactVersions,
    ...sample.ranges,
  ];
  describe.each(goodSample)('Good values', input => {
    it(input, () => {
      expect(poetry.isValid(input)).toBeTruthy();
    });
  });

  const badSample = sample.invalidInputs;
  describe.each(badSample)('Bad values', input => {
    it(input, () => {
      expect(poetry.isValid(input)).toBeFalsy();
    });
  });
});

describe('isSingleVersion', () => {
  const goodSample = [...sample.singleVersions, ...sample.exactVersions];
  describe.each(goodSample)('Good values', input => {
    it(input, () => {
      expect(poetry.isSingleVersion(input)).toBeTruthy();
    });
  });

  const badSample = [...sample.invalidInputs, ...sample.ranges];
  describe.each(badSample)('Bad values', input => {
    it(input, () => {
      expect(poetry.isSingleVersion(input)).toBeFalsy();
    });
  });
});

describe('semver.matches()', () => {
  it('handles comma', () => {
    expect(poetry.matches('4.2.0', '4.2, >= 3.0, < 5.0.0')).toBe(true);
    expect(poetry.matches('4.2.0', '2.0, >= 3.0, < 5.0.0')).toBe(false);
    expect(poetry.matches('4.2.2', '4.2.0, < 4.2.4')).toBe(false);
    expect(poetry.matches('4.2.2', '^4.2.0, < 4.2.4')).toBe(true);
    expect(poetry.matches('4.2.0', '4.3.0, 3.0.0')).toBe(false);
    expect(poetry.matches('4.2.0', '> 5.0.0, <= 6.0.0')).toBe(false);
  });
});
describe('semver.isLessThanRange()', () => {
  it('handles comma', () => {
    expect(poetry.isLessThanRange('0.9.0', '>= 1.0.0 <= 2.0.0')).toBe(true);
    expect(poetry.isLessThanRange('1.9.0', '>= 1.0.0 <= 2.0.0')).toBe(false);
  });
});

describe('Satisfying versions', () => {
  describe.each(sample.minMaxSample)('minSatisfyingVersion', sampleElem => {
    const { versionList, range, min, max } = sampleElem;
    it(range, () => {
      expect(poetry.minSatisfyingVersion(versionList, range)).toBe(min);
    });
  });

  describe.each(sample.minMaxSample)('maxSatisfyingVersion', sampleElem => {
    const { versionList, range, min, max } = sampleElem;
    it(range, () => {
      expect(poetry.maxSatisfyingVersion(versionList, range)).toBe(max);
    });
  });
});

const getNewValueTestCases: NewValueTestConfig[] = [
  {
    title: 'bumps exact',
    currentValue: '1.0.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '1.1.0',
  },
  {
    title: 'bumps exact',
    currentValue: '   1.0.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '1.1.0',
  },
  {
    title: 'bumps exact',
    currentValue: '1.0.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '1.1.0',
  },
  {
    title: 'bumps equals',
    currentValue: '=1.0.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '=1.1.0',
  },
  {
    title: 'bumps equals',
    currentValue: '=  1.0.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '=1.1.0',
  },
  {
    title: 'bumps equals space',
    currentValue: '= 1.0.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '=1.1.0',
  },
  {
    title: 'bumps equals space',
    currentValue: '  = 1.0.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '=1.1.0',
  },
  {
    title: 'bumps equals space',
    currentValue: '  =   1.0.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '=1.1.0',
  },
  {
    title: 'bumps equals space',
    currentValue: '=    1.0.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '=1.1.0',
  },
  {
    title: 'bumps short caret to same',
    currentValue: '^1.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.0.7',
    expectedValue: '^1.0',
  },
  {
    title: 'replaces caret with newer',
    currentValue: '^1.0.0',
    rangeStrategy: 'replace',
    fromVersion: '1.0.0',
    toVersion: '2.0.7',
    expectedValue: '^2.0.0',
  },
  {
    title: 'replaces naked version',
    currentValue: '1.0.0',
    rangeStrategy: 'replace',
    fromVersion: '1.0.0',
    toVersion: '2.0.7',
    expectedValue: '2.0.7',
  },
  {
    title: 'replaces with version range',
    currentValue: '1.0.0',
    rangeStrategy: 'replace',
    fromVersion: '1.0.0',
    toVersion: '^2.0.7',
    expectedValue: '^2.0.7',
  },
  {
    title: 'bumps naked caret',
    currentValue: '^1',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '2.1.7',
    expectedValue: '^2',
  },
  {
    title: 'bumps naked tilde',
    currentValue: '~1',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.7',
    expectedValue: '~1',
  },
  {
    title: 'bumps naked major',
    currentValue: '5',
    rangeStrategy: 'bump',
    fromVersion: '5.0.0',
    toVersion: '5.1.7',
    expectedValue: '5',
  },
  {
    title: 'bumps naked major',
    currentValue: '5',
    rangeStrategy: 'bump',
    fromVersion: '5.0.0',
    toVersion: '6.1.7',
    expectedValue: '6',
  },
  {
    title: 'bumps naked minor',
    currentValue: '5.0',
    rangeStrategy: 'bump',
    fromVersion: '5.0.0',
    toVersion: '5.0.7',
    expectedValue: '5.0',
  },
  {
    title: 'bumps naked minor',
    currentValue: '5.0',
    rangeStrategy: 'bump',
    fromVersion: '5.0.0',
    toVersion: '5.1.7',
    expectedValue: '5.1',
  },
  {
    title: 'bumps naked minor',
    currentValue: '5.0',
    rangeStrategy: 'bump',
    fromVersion: '5.0.0',
    toVersion: '6.1.7',
    expectedValue: '6.1',
  },
  {
    title: 'replaces minor',
    currentValue: '5.0',
    rangeStrategy: 'replace',
    fromVersion: '5.0.0',
    toVersion: '6.1.7',
    expectedValue: '6.1',
  },
  {
    title: 'replaces equals',
    currentValue: '=1.0.0',
    rangeStrategy: 'replace',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '=1.1.0',
  },
  {
    title: 'bumps caret to prerelease',
    currentValue: '^1',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.0.7-prerelease.1',
    expectedValue: '^1.0.7-prerelease.1',
  },
  {
    title: 'replaces with newer',
    currentValue: '^1.0.0',
    rangeStrategy: 'replace',
    fromVersion: '1.0.0',
    toVersion: '1.0.7',
    expectedValue: '^1.0.7',
  },
  {
    title: 'bumps short tilde',
    currentValue: '~1.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.7',
    expectedValue: '~1.1',
  },
  {
    title: 'handles long asterisk',
    currentValue: '1.0.*',
    rangeStrategy: 'replace',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '1.1.*',
  },
  {
    title: 'handles short asterisk',
    currentValue: '1.*',
    rangeStrategy: 'replace',
    fromVersion: '1.0.0',
    toVersion: '2.1.0',
    expectedValue: '2.*',
  },
  {
    title: 'handles updating from stable to unstable',
    currentValue: '~0.6.1',
    rangeStrategy: 'replace',
    fromVersion: '0.6.8',
    toVersion: '0.7.0-rc.2',
    expectedValue: '~0.7.0-rc',
  },
  {
    title: 'handles less than version requirements',
    currentValue: '<1.3.4',
    rangeStrategy: 'replace',
    fromVersion: '1.2.3',
    toVersion: '1.5.0',
    expectedValue: '<1.5.1',
  },
  {
    title: 'handles less than version requirements',
    currentValue: '< 1.3.4',
    rangeStrategy: 'replace',
    fromVersion: '1.2.3',
    toVersion: '1.5.0',
    expectedValue: '< 1.5.1',
  },
  {
    title: 'handles less than version requirements',
    currentValue: '<   1.3.4',
    rangeStrategy: 'replace',
    fromVersion: '1.2.3',
    toVersion: '1.5.0',
    expectedValue: '< 1.5.1',
  },
  {
    title: 'handles less than equals version requirements',
    currentValue: '<=1.3.4',
    rangeStrategy: 'replace',
    fromVersion: '1.2.3',
    toVersion: '1.5.0',
    expectedValue: '<=1.5.0',
  },
  {
    title: 'handles less than equals version requirements',
    currentValue: '<= 1.3.4',
    rangeStrategy: 'replace',
    fromVersion: '1.2.3',
    toVersion: '1.5.0',
    expectedValue: '<= 1.5.0',
  },
  {
    title: 'handles less than equals version requirements',
    currentValue: '<=   1.3.4',
    rangeStrategy: 'replace',
    fromVersion: '1.2.3',
    toVersion: '1.5.0',
    expectedValue: '<= 1.5.0',
  },
  {
    title: 'handles replacing short caret versions',
    currentValue: '^1.2',
    rangeStrategy: 'replace',
    fromVersion: '1.2.3',
    toVersion: '2.0.0',
    expectedValue: '^2.0',
  },
  {
    title: 'handles replacing short caret versions',
    currentValue: '^1',
    rangeStrategy: 'replace',
    fromVersion: '1.2.3',
    toVersion: '2.0.0',
    expectedValue: '^2',
  },
  {
    title: 'handles replacing short tilde versions',
    currentValue: '~1.2',
    rangeStrategy: 'replace',
    fromVersion: '1.2.3',
    toVersion: '2.0.0',
    expectedValue: '~2.0',
  },
  {
    title: 'handles replacing short tilde versions',
    currentValue: '~1',
    rangeStrategy: 'replace',
    fromVersion: '1.2.3',
    toVersion: '2.0.0',
    expectedValue: '~2',
  },
];

describe.each(sample.getNewValueTestCases)(
  'poetry.getNewValue()',
  getNewValueTestSuite(poetry.getNewValue)
);
