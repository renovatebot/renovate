const semver = require('semver');
const stable = require('semver-stable');
const semverUtils = require('semver-utils');

const { is: isStable } = stable;
const isUnstable = input => !isStable(input);

const { parseRange, parse: parseVersion, stringifyRange } = semverUtils;

const {
  compare: semverSort,
  gt: isGreaterThan,
  maxSatisfying: maxSatisfyingVersion,
  minSatisfying: minSatisfyingVersion,
  minor: getMinor,
  patch: getPatch,
  satisfies: matchesSemver,
  valid: isPinnedVersion,
  validRange: isValidRange,
} = semver;

const isVersionOrRange = input =>
  (semver.valid(input) || semver.validRange(input)) !== null;

const padRange = range => range + '.0'.repeat(3 - range.split('.').length);

const getMajor = input => {
  const version = isPinnedVersion(input) ? input : padRange(input);
  return semver.major(version);
};

module.exports = {
  getMajor,
  getMinor,
  getPatch,
  isGreaterThan,
  isStable,
  isUnstable,
  isValidRange,
  isPinnedVersion,
  isVersionOrRange,
  matchesSemver,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  parseRange,
  parseVersion,
  semverSort,
  stringifyRange,
};
