const semver = require('semver');
const stable = require('semver-stable');
const semverUtils = require('semver-utils');

const isStable = input => stable.is(input);
const isUnstable = input => !stable.is(input);

const { parseRange, parse: parseVersion, stringifyRange } = semverUtils;

const isValidSemver = input =>
  (semver.valid(input) || semver.validRange(input)) !== null;

const isValidSemverRange = input => semver.validRange(input);

const semverSort = (a, b) => semver.compare(a, b);

module.exports = {
  isStable,
  isUnstable,
  isValidSemver,
  isValidSemverRange,
  parseRange,
  parseVersion,
  stringifyRange,
  semverSort,
};
