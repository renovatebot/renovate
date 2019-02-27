/* istanbul ignore file */

const { compare } = require('./compare');

const equals = (a, b) => compare(a, b) === 0;

// TODO getMajor
const getMajor = () => 0;

// TODO getMinor
const getMinor = () => 0;

// TODO getPatch
const getPatch = () => 0;

const isGreaterThan = (a, b) => compare(a, b) === 1;

// TODO isStable
const isStable = () => true;

// TODO isVersion
const isVersion = () => true;

const maxSatisfyingVersion = (versions, range) =>
  versions.find(version => equals(version, range));

const getNewValue = (currentValue, rangeStrategy, fromVersion, toVersion) =>
  toVersion;

module.exports = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isCompatible: isVersion,
  isGreaterThan,
  isSingleVersion: isVersion,
  isStable,
  isValid: isVersion,
  isVersion,
  matches: equals,
  maxSatisfyingVersion,
  minSatisfyingVersion: maxSatisfyingVersion,
  getNewValue,
  sortVersions: compare,
};
