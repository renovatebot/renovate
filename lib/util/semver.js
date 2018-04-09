const semver = require('semver');
const stable = require('semver-stable');

const isStable = input => stable.is(input);
const isUnstable = input => !stable.is(input);

const isValidSemver = input =>
  (semver.valid(input) || semver.validRange(input)) !== null;

module.exports = {
  isStable,
  isUnstable,
  isValidSemver,
};
