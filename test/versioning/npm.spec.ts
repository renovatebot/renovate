import { api as semver } from '../../lib/versioning/npm';
import { getNewValueTestSuite } from './common';
import { sample } from './npm.data';
import pep440 from '../../lib/versioning/npm';

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

describe.each(sample.getNewValueTestCases)(
  'getNewValue',
  getNewValueTestSuite(semver.getNewValue)
);
