const semver = require('../semver');

function padZeroes(input) {
  const sections = input.split('.');
  if (sections.length < 3) {
    sections.push('0');
  }
  if (sections.length < 2) {
    sections.push('0');
  }
  return sections.join('.');
}

function composer2npm(input) {
  if (semver.isVersion(input)) {
    return input;
  }
  if (semver.isVersion(padZeroes(input))) {
    return padZeroes(input);
  }
  let output = input;
  // ~4 to ^4 and ~4.1 to ^4.1
  output = output.replace(/(?:^|\s)~([1-9][0-9]*(?:\.[0-9]*)?)(?: |$)/g, '^$1');
  // ~0.4 to >=0.4 <1
  output = output.replace(/(?:^|\s)~(0\.[1-9][0-9]*)(?: |$)/g, '>=$1 <1');
  return output;
}

const equals = (a, b) => semver.equals(composer2npm(a), composer2npm(b));

const getMajor = version => semver.getMajor(composer2npm(version));

const getMinor = version => semver.getMinor(composer2npm(version));

const isGreaterThan = (a, b) =>
  semver.isGreaterThan(composer2npm(a), composer2npm(b));

const isLessThanRange = (version, range) =>
  semver.isLessThanRange(composer2npm(version), composer2npm(range));

const isSingleVersion = input => semver.isSingleVersion(composer2npm(input));

const isStable = version => semver.isStable(composer2npm(version));

const isValid = input => semver.isValid(composer2npm(input));

const isVersion = input => semver.isVersion(composer2npm(input));

const matches = (version, range) =>
  semver.matches(composer2npm(version), composer2npm(range));

const maxSatisfyingVersion = (versions, range) =>
  semver.maxSatisfyingVersion(versions.map(composer2npm), composer2npm(range));

const minSatisfyingVersion = (versions, range) =>
  semver.minSatisfyingVersion(versions.map(composer2npm), composer2npm(range));

function getNewValue(currentValue, rangeStrategy, fromVersion, toVersion) {
  logger.debug('getNewValue');
  if (isVersion(currentValue)) {
    return toVersion;
  }
  if (
    semver.isValid(currentValue) &&
    composer2npm(currentValue) === currentValue
  ) {
    logger.debug('Using semver getNewValue');
    let newValue = semver.getNewValue(
      currentValue,
      rangeStrategy,
      composer2npm(fromVersion),
      composer2npm(toVersion)
    );
    if (currentValue.split('.')[0].includes('v')) {
      newValue = newValue.replace(/([0-9])/, 'v$1').replace(/vv([0-9])/, 'v$1');
    }
    const newSplit = newValue.split('.');
    newSplit.length = toVersion.split('.').length;
    return newSplit.join('.');
  }
  logger.debug('Using custom getNewValue');
  const toMajor = getMajor(toVersion);
  const toMinor = getMinor(toVersion);
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

function sortVersions(a, b) {
  return semver.sortVersions(composer2npm(a), composer2npm(b));
}

module.exports = {
  equals,
  getMajor,
  getMinor,
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
