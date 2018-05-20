const semver = require('semver');
const stable = require('semver-stable');
const semverUtils = require('semver-utils');
const { rangify } = require('./range');

const { is: isStable } = stable;

const { parseRange, parse: parseVersion } = semverUtils;

const {
  compare: semverSort,
  gt,
  gtr,
  lt,
  ltr,
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

const isLessThan = (version, base) =>
  isPinnedVersion(base) ? lt(version, base) : ltr(version, base);

const isGreaterThan = (version, base) =>
  isPinnedVersion(base) ? gt(version, base) : gtr(version, base);

module.exports = {
  getMajor,
  getMinor,
  getPatch,
  intersectsSemver,
  isGreaterThan,
  isLessThan,
  isRange,
  isStable,
  isValidSemver,
  isPinnedVersion,
  matchesSemver,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  parseRange,
  parseVersion,
  rangify,
  semverSort,
};
