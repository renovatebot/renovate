const semver = require('semver');
const stable = require('semver-stable');
const semverUtils = require('semver-utils');

const { is: isStable } = stable;
const isUnstable = input => !isStable(input);

const { parseRange, parse: parseVersion, stringifyRange } = semverUtils;

const {
  compare: semverSort,
  gt: isGreaterThan,
  intersects: intersectsSemver,
  maxSatisfying: maxSatisfyingVersion,
  minSatisfying: minSatisfyingVersion,
  minor: getMinor,
  patch: getPatch,
  satisfies: matchesSemver,
  valid: isPinnedVersion,
} = semver;

const padRange = range => range + '.0'.repeat(3 - range.split('.').length);

const getMajor = input => {
  const version = isPinnedVersion(input) ? input : padRange(input);
  return semver.major(version);
};

const isRange = input => isValidSemver(input) && !isPinnedVersion(input);

// If this is left as an alias, inputs like "17.04.0" throw errors
const isValidSemver = input => semver.validRange(input);

module.exports = {
  getMajor,
  getMinor,
  getPatch,
  intersectsSemver,
  isGreaterThan,
  isRange,
  isStable,
  isUnstable,
  isValidSemver,
  isPinnedVersion,
  matchesSemver,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  parseRange,
  parseVersion,
  semverSort,
  stringifyRange,
};
