const semver = require('semver');
const stable = require('semver-stable');
const semverUtils = require('semver-utils');

const { is: isStable } = stable;
const isUnstable = input => !isStable(input);

const { parseRange, parse: parseVersion, stringifyRange } = semverUtils;

const {
  minor: getMinor,
  gt: isGreaterThan,
  validRange: isValidRange,
  valid: isValidVersion,
  maxSatisfying: maxSatisfyingVersion,
  compare: semverSort,
} = semver;

const isValidVersionOrRange = input =>
  (semver.valid(input) || semver.validRange(input)) !== null;

const padRange = range => range + '.0'.repeat(3 - range.split('.').length);

const getMajor = input => {
  const version = isValidVersion(input) ? input : padRange(input);
  return semver.major(version);
};

module.exports = {
  isStable,
  isUnstable,
  isValidVersion,
  isValidVersionOrRange,
  isValidRange,
  parseRange,
  parseVersion,
  stringifyRange,
  semverSort,
  getMajor,
  getMinor,
  isGreaterThan,
  maxSatisfyingVersion,
};
