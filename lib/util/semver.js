const semver = require('semver');

const isValidSemver = input =>
  (semver.valid(input) || semver.validRange(input)) !== null;

module.exports = {
  isValidSemver,
};
