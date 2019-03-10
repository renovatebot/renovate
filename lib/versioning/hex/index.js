const npm = require('../npm');

function hex2npm(input) {
  return input
    .replace(/~>\s*(\d+\.\d+(\.\d+.*)?)/, (str, p1) => '~' + p1.slice(0, -2))
    .replace('and', '')
    .replace('or', '||')
    .replace(/==|!=/, '');
}

const isLessThanRange = (version, range) =>
  npm.isLessThanRange(hex2npm(version), hex2npm(range));

const isValid = input => npm.isValid(hex2npm(input));

const matches = (version, range) =>
  npm.matches(hex2npm(version), hex2npm(range));

const maxSatisfyingVersion = (versions, range) =>
  npm.maxSatisfyingVersion(versions.map(hex2npm), hex2npm(range));

const minSatisfyingVersion = (versions, range) =>
  npm.minSatisfyingVersion(versions.map(hex2npm), hex2npm(range));

const getNewValue = (currentValue, rangeStrategy, fromVersion, toVersion) => {
  if (currentValue.match(/(~>\s*)\d+\.\d+$/)) {
    return currentValue.replace(
      /(~>\s*)\d+\.\d+$/,
      `$1${npm.getMajor(toVersion)}.0`
    );
  }
  return npm.getNewValue(currentValue, rangeStrategy, fromVersion, toVersion);
};

module.exports = {
  ...npm,
  isLessThanRange,
  isValid,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
};
