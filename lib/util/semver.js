const semver = require('semver');

const isValidVersion = input =>
  (semver.valid(input) || semver.validRange(input)) !== null;

module.exports = {
  isValidVersion,
};
