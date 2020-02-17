import { api as semver } from '../../lib/versioning/npm';
import { getNewValueTestSuite } from './common';
import { sample } from './npm.data';

describe('isValid', () => {
  const goodSample = [
    ...sample.singleVersions,
    ...sample.exactVersions,
    ...sample.ranges,
  ];
  describe.each(goodSample)('Good values', input => {
    it(input, () => {
      expect(semver.isValid(input)).toBeTruthy();
    });
  });

  const badSample = sample.invalidInputs;
  describe.each(badSample)('Bad values', input => {
    it(input, () => {
      expect(semver.isValid(input)).toBeFalsy();
    });
  });
});

describe('isSingleVersion', () => {
  const goodSample = [...sample.singleVersions, ...sample.exactVersions];
  describe.each(goodSample)('Good values', input => {
    it(input, () => {
      expect(semver.isSingleVersion(input)).toBeTruthy();
    });
  });

  const badSample = [...sample.invalidInputs, ...sample.ranges];
  describe.each(badSample)('Bad values', input => {
    it(input, () => {
      expect(semver.isSingleVersion(input)).toBeFalsy();
    });
  });
});

describe.each(sample.getNewValueTestCases)(
  'getNewValue',
  getNewValueTestSuite(semver.getNewValue)
);
