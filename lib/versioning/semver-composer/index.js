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
  if (
    semver.isValid(currentValue) &&
    composer2npm(currentValue) === currentValue
  ) {
    return semver.getNewValue(
      currentValue,
      rangeStrategy,
      fromVersion,
      toVersion
    );
  }
  const toMajor = semver.getMajor(toVersion);
  const toMinor = semver.getMinor(toVersion);
  // handle ~0.4 case first
  if (currentValue.match(/^~(0\.[1-9][0-9]*)$/)) {
    if (toMajor === 0) {
      return `~0.${toMinor}`;
    }
    return `~${toMajor}.0`;
  }
  // handle ~4 case
  if (currentValue.match(/^~([0-9]*)$/)) {
    return `~${toMajor}`;
  }
  // handle ~4.1 case
  if (currentValue.match(/^~([0-9]*(?:\.[0-9]*)?)$/)) {
    return `~${toMajor}.${toMinor}`;
  }
  logger.warn('Unsupported composer selector');
  return toVersion;
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
