const semver = require('semver');
const stable = require('semver-stable');
const { getNewValue } = require('./range');

const { is: isStable } = stable;

const {
  compare: sortVersions,
  maxSatisfying: maxSatisfyingVersion,
  minSatisfying: minSatisfyingVersion,
  minor: getMinor,
  satisfies: matches,
  valid,
  validRange,
  ltr: isLessThanRange,
  gt: isGreaterThan,
  eq: equals,
} = semver;

const padRange = range => range + '.0'.repeat(3 - range.split('.').length);

const getMajor = input => {
  const version = isVersion(input) ? input : padRange(input);
  return semver.major(version);
};

// If this is left as an alias, inputs like "17.04.0" throw errors
const isValid = input => validRange(input);
const isVersion = input => valid(input);

const isSingleVersion = constraint =>
  isVersion(constraint) ||
  (constraint.startsWith('=') && isVersion(constraint.substring(1).trim()));

module.exports = {
  equals,
  getMajor,
  getMinor,
  isGreaterThan,
  isLessThanRange,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,
};
