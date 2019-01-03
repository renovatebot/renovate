const semver = require('../npm');

function hashicorp2npm(input) {
  // The only case incompatible with semver is a "short" ~>, e.g. ~> 1.2
  return input.replace(/~>(\s*\d+\.\d+$)/, '^$1').replace(',', '');
}

const isLessThanRange = (version, range) =>
  semver.isLessThanRange(hashicorp2npm(version), hashicorp2npm(range));

const isValid = input => semver.isValid(hashicorp2npm(input));

const matches = (version, range) =>
  semver.matches(hashicorp2npm(version), hashicorp2npm(range));

const maxSatisfyingVersion = (versions, range) =>
  semver.maxSatisfyingVersion(
    versions.map(hashicorp2npm),
    hashicorp2npm(range)
  );

const minSatisfyingVersion = (versions, range) =>
  semver.minSatisfyingVersion(
    versions.map(hashicorp2npm),
    hashicorp2npm(range)
  );

function getNewValue(currentValue, rangeStrategy, fromVersion, toVersion) {
  // handle specia. ~> 1.2 case
  if (currentValue.match(/(~>\s*)\d+\.\d+$/)) {
    return currentValue.replace(
      /(~>\s*)\d+\.\d+$/,
      `$1${semver.getMajor(toVersion)}.0`
    );
  }
  return semver.getNewValue(
    currentValue,
    rangeStrategy,
    fromVersion,
    toVersion
  );
}

module.exports = {
  ...semver,
  isLessThanRange,
  isValid,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
};
