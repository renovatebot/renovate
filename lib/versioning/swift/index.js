const semver = require('semver');
const stable = require('semver-stable');
const { toSemverRange, getNewValue } = require('./range');

const { is: isStable } = stable;

const {
  compare: sortVersions,
  maxSatisfying,
  minSatisfying,
  major: getMajor,
  minor: getMinor,
  patch: getPatch,
  satisfies,
  valid,
  validRange,
  ltr,
  gt: isGreaterThan,
  eq: equals,
} = semver;

const isValid = input => !!valid(input) || !!validRange(toSemverRange(input));
const isVersion = input => !!valid(input);
const maxSatisfyingVersion = (versions, range) =>
  maxSatisfying(versions, toSemverRange(range));
const minSatisfyingVersion = (versions, range) =>
  minSatisfying(versions, toSemverRange(range));
const isLessThanRange = (version, range) => ltr(version, toSemverRange(range));
const matches = (version, range) => satisfies(version, toSemverRange(range));

module.exports = {
  equals,
  getMajor,
  getMinor,
  getNewValue,
  getPatch,
  isCompatible: isVersion,
  isGreaterThan,
  isLessThanRange,
  isSingleVersion: isVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  sortVersions,
};
