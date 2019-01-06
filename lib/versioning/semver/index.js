const semver = require('semver');
const stable = require('semver-stable');

const { is: isStable } = stable;

const {
  coerce,
  compare: sortVersions,
  eq: equals,
  gt: isGreaterThan,
  ltr: isLessThanRange,
  major: getMajor,
  maxSatisfying: maxSatisfyingVersion,
  minor: getMinor,
  minSatisfying: minSatisfyingVersion,
  patch: getPatch,
  satisfies: matches,
  valid,
  validRange,
} = semver;

// If this is left as an alias, inputs like "17.04.0" throw errors
const isVersion = input => valid(input);

function getNewValue(currentValue, rangeStrategy, fromVersion, toVersion) {
  return toVersion;
}

module.exports = {
  coerce,
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
  isValid: isVersion,
  isVersion,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  sortVersions,
};
