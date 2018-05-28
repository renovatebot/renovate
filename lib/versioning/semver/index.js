const semver = require('semver');
const stable = require('semver-stable');
const { rangify } = require('./range');

const { is: isStable } = stable;

const {
  compare: sortVersions,
  intersects,
  maxSatisfying: maxSatisfyingVersion,
  minSatisfying: minSatisfyingVersion,
  minor: getMinor,
  satisfies: matches,
  valid: isPinnedVersion,
  validRange,
} = semver;

const padRange = range => range + '.0'.repeat(3 - range.split('.').length);

const getMajor = input => {
  const version = isPinnedVersion(input) ? input : padRange(input);
  return semver.major(version);
};

const isRange = input => isValid(input) && !isPinnedVersion(input);

// If this is left as an alias, inputs like "17.04.0" throw errors
const isValid = input => validRange(input);

const isLessThan = (version, base) =>
  isPinnedVersion(base) ? semver.lt(version, base) : semver.ltr(version, base);

const isGreaterThan = (version, base) =>
  isPinnedVersion(base) ? semver.gt(version, base) : semver.gtr(version, base);

module.exports = {
  getMajor,
  getMinor,
  intersects,
  isGreaterThan,
  isLessThan,
  isPinnedVersion,
  isRange,
  isStable,
  isValid,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  rangify,
  sortVersions,
};
