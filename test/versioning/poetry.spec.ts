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

describe.each(sample.getNewValueTestCases)(
  'poetry.getNewValue()',
  getNewValueTestSuite(poetry.getNewValue)
);
