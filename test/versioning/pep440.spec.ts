import pep440 from '../../lib/versioning/pep440';
import { getNewValueTestSuite } from './common';
import { sample } from './pep440.data';

describe('isValid', () => {
  const goodSample = [
    ...sample.singleVersions,
    ...sample.exactVersions,
    ...sample.ranges,
  ];
  describe.each(goodSample)('Good values', input => {
    it(input, () => {
      expect(pep440.isValid(input)).toBeTruthy();
    });
  });

  const badSample = sample.invalidInputs;
  describe.each(badSample)('Bad values', input => {
    it(input, () => {
      expect(pep440.isValid(input)).toBeFalsy();
    });
  });
});

describe('isStable', () => {
  const goodSample = sample.stableSingle;
  describe.each(goodSample)('Good values', input => {
    it(input, () => {
      expect(pep440.isStable(input)).toBeTruthy();
    });
  });

  const badSample = [
    ...sample.unstableSingle,
    ...sample.unstableExact,
    ...sample.stableExact, // ?
  ];
  describe.each(badSample)('Bad values', input => {
    it(input, () => {
      expect(pep440.isStable(input)).toBeFalsy();
    });
  });
});

describe('isSingleVersion', () => {
  const goodSample = [...sample.singleVersions, ...sample.exactVersions];
  describe.each(goodSample)('Good values', input => {
    it(input, () => {
      expect(pep440.isSingleVersion(input)).toBeTruthy();
    });
  });

  const badSample = [...sample.invalidInputs, ...sample.ranges];
  describe.each(badSample)('Bad values', input => {
    it(input, () => {
      expect(pep440.isSingleVersion(input)).toBeFalsy();
    });
  });
});

describe('Satisfying versions', () => {
  describe.each(sample.minMaxSample)('minSatisfyingVersion', sampleElem => {
    const { versionList, range, min } = sampleElem;
    it(range, () => {
      expect(pep440.minSatisfyingVersion(versionList, range)).toBe(min);
    });
  });

  describe.each(sample.minMaxSample)('maxSatisfyingVersion', sampleElem => {
    const { versionList, range, max } = sampleElem;
    it(range, () => {
      expect(pep440.maxSatisfyingVersion(versionList, range)).toBe(max);
    });
  });
});

describe.each(sample.getNewValueTestCases)(
  'getNewValue',
  getNewValueTestSuite(pep440.getNewValue)
);
