const semver = require('../semver');

function hashicorp2npm(input) {
  if (semver.isVersion(input)) {
    return input;
  }
  let output = input;

  // ~> 1.2 to ^ 1.2
  if (output.startsWith('~>')) {
    debugger;
    output = output.replace(/~>(\s*\d+\.\d+$)/, '^$1');
  }

  return output;
}

const equals = (a, b) => semver.equals(hashicorp2npm(a), hashicorp2npm(b));

const getMajor = version => semver.getMajor(hashicorp2npm(version));

const getMinor = version => semver.getMinor(hashicorp2npm(version));

const getPatch = version => semver.getPatch(hashicorp2npm(version));

const isGreaterThan = (a, b) =>
  semver.isGreaterThan(hashicorp2npm(a), hashicorp2npm(b));

const isLessThanRange = (version, range) =>
  semver.isLessThanRange(hashicorp2npm(version), hashicorp2npm(range));

const isSingleVersion = input => semver.isSingleVersion(hashicorp2npm(input));

const isStable = version => semver.isStable(hashicorp2npm(version));

const isValid = input => semver.isValid(hashicorp2npm(input));

const isVersion = input => semver.isVersion(hashicorp2npm(input));

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
  const toMajor = getMajor(toVersion);
  let newValue;
  if (isVersion(currentValue)) {
    newValue = toVersion;
  } else if (currentValue.match(/(~>\s*)\d+\.\d+$/)) {
    // handle ~> 1.2 case first
    newValue = currentValue.replace(/(~>\s*)\d+\.\d+$/, `$1${toMajor}.0`);
  } else if (
    semver.isVersion(toVersion) &&
    semver.isValid(currentValue) &&
    hashicorp2npm(currentValue) === currentValue
  ) {
    newValue = semver.getNewValue(
      currentValue,
      rangeStrategy,
      fromVersion,
      toVersion
    );
  }
  if (!newValue) {
    logger.warn('Unsupported hashicorp semver');
    newValue = toVersion;
  }
  return newValue;
}

function sortVersions(a, b) {
  return semver.sortVersions(hashicorp2npm(a), hashicorp2npm(b));
}

module.exports = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isGreaterThan,
  isLessThanRange,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,
};
