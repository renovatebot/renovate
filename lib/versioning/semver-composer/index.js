const semver = require('../semver');

function composer2npm(input) {
  if (semver.isVersion(input)) {
    return input;
  }
  let output = input;
  // ~4 to ^4 and ~4.1 to ^4.1
  output = output.replace(/(?:^|\s)~([1-9][0-9]*(?:\.[0-9]*)?)(?: |$)/g, '^$1');
  // ~0.4 to >=0.4 <1
  output = output.replace(/(?:^|\s)~(0\.[1-9][0-9]*)(?: |$)/g, '>=$1 <1');
  return output;
}

const isLessThanRange = (version, range) =>
  semver.isLessThanRange(version, composer2npm(range));

const isValid = input => semver.isValid(composer2npm(input));

const matches = (version, range) =>
  semver.matches(version, composer2npm(range));

const maxSatisfyingVersion = (versions, range) =>
  semver.maxSatisfyingVersion(versions, composer2npm(range));

const minSatisfyingVersion = (versions, range) =>
  semver.minSatisfyingVersion(versions, composer2npm(range));

function getNewValue(currentValue, rangeStrategy, fromVersion, toVersion) {
  const toMajor = semver.getMajor(toVersion);
  const toMinor = semver.getMinor(toVersion);
  let newValue = toVersion;
  if (
    semver.isValid(currentValue) &&
    composer2npm(currentValue) === currentValue
  ) {
    newValue = semver.getNewValue(
      currentValue,
      rangeStrategy,
      fromVersion,
      toVersion
    );
  } else if (currentValue.match(/^~(0\.[1-9][0-9]*)$/)) {
    // handle ~0.4 case first
    if (toMajor === 0) {
      newValue = `~0.${toMinor}`;
    } else {
      newValue = `~${toMajor}.0`;
    }
  } else if (currentValue.match(/^~([0-9]*)$/)) {
    // handle ~4 case
    newValue = `~${toMajor}`;
  } else if (currentValue.match(/^~([0-9]*(?:\.[0-9]*)?)$/)) {
    // handle ~4.1 case
    newValue = `~${toMajor}.${toMinor}`;
  }
  if (currentValue.split('.')[0].includes('v')) {
    newValue = newValue.replace(/([0-9])/, 'v$1');
  }
  return newValue;
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
