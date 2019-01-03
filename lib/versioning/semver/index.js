// This is a plain semver without any concepts of ranges

const semver = require('semver');
const stable = require('semver-stable');

const { is: isStable } = stable;

const {
  compare: sortVersions,
  maxSatisfying: maxSatisfyingVersion,
  minSatisfying: minSatisfyingVersion,
  major: getMajor,
  minor: getMinor,
  patch: getPatch,
  ltr: isLessThanRange,
  gt: isGreaterThan,
  eq: equals,
} = semver;

// If this is left as an alias, inputs like "17.04.0" throw errors
const isVersion = input => semver.valid(input);

function getNewValue(currentValue, rangeStrategy, fromVersion, toVersion) {
  // No ranges so we always return the exact version
  return toVersion;
}

module.exports = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isCompatible: isVersion,
  isGreaterThan,
  isLessThanRange,
  isSingleVersion: isVersion,
  isStable,
  isValid: isVersion, // only versions are valid
  isVersion,
  matches: equals,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,
};
