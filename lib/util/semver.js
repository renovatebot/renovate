const semver = require('semver');
const stable = require('semver-stable');
const semverUtils = require('semver-utils');

const isStable = input => stable.is(input);
const isUnstable = input => !stable.is(input);

const { parseRange, parse: parseVersion, stringifyRange } = semverUtils;

const isValidSemver = input =>
  (semver.valid(input) || semver.validRange(input)) !== null;

module.exports = {
  isStable,
  isUnstable,
  isValidSemver,
  parseRange,
  parseVersion,
  stringifyRange,
};
