const semver = require('semver');
const stable = require('semver-stable');
const semverUtils = require('semver-utils');

const isStable = input => stable.is(input);
const isUnstable = input => !stable.is(input);

const { parseRange, parse: parseVersion, stringifyRange } = semverUtils;

const isValidVersionOrRange = input =>
  (semver.valid(input) || semver.validRange(input)) !== null;

const isValidRange = input => semver.validRange(input);

const semverSort = (a, b) => semver.compare(a, b);

module.exports = {
  isStable,
  isUnstable,
  isValidVersionOrRange,
  isValidRange,
  parseRange,
  parseVersion,
  stringifyRange,
  semverSort,
};
