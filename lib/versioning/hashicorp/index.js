const npm = require('../npm');

function hashicorp2npm(input) {
  // The only case incompatible with semver is a "short" ~>, e.g. ~> 1.2
  return input.replace(/~>(\s*\d+\.\d+$)/, '^$1').replace(',', '');
}

const isLessThanRange = (version, range) =>
  npm.isLessThanRange(hashicorp2npm(version), hashicorp2npm(range));

const isValid = input => npm.isValid(hashicorp2npm(input));

const matches = (version, range) =>
  npm.matches(hashicorp2npm(version), hashicorp2npm(range));

const maxSatisfyingVersion = (versions, range) =>
  npm.maxSatisfyingVersion(versions.map(hashicorp2npm), hashicorp2npm(range));

const minSatisfyingVersion = (versions, range) =>
  npm.minSatisfyingVersion(versions.map(hashicorp2npm), hashicorp2npm(range));

function getNewValue(currentValue, rangeStrategy, fromVersion, toVersion) {
  // handle specia. ~> 1.2 case
  if (currentValue.match(/(~>\s*)\d+\.\d+$/)) {
    return currentValue.replace(
      /(~>\s*)\d+\.\d+$/,
      `$1${npm.getMajor(toVersion)}.0`
    );
  }
  return npm.getNewValue(currentValue, rangeStrategy, fromVersion, toVersion);
}

module.exports = {
  ...npm,
  isLessThanRange,
  isValid,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
};
