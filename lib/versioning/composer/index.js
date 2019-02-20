const npm = require('../npm');

function padZeroes(input) {
  const sections = input.split('.');
  while (sections.length < 3) {
    sections.push('0');
  }
  return sections.join('.');
}

function composer2npm(input) {
  if (npm.isVersion(input)) {
    return input;
  }
  if (npm.isVersion(padZeroes(input))) {
    return padZeroes(input);
  }
  let output = input;
  // ~4 to ^4 and ~4.1 to ^4.1
  output = output.replace(/(?:^|\s)~([1-9][0-9]*(?:\.[0-9]*)?)(?: |$)/g, '^$1');
  // ~0.4 to >=0.4 <1
  output = output.replace(/(?:^|\s)~(0\.[1-9][0-9]*)(?: |$)/g, '>=$1 <1');
  return output;
}

const equals = (a, b) => npm.equals(composer2npm(a), composer2npm(b));

const getMajor = version => npm.getMajor(composer2npm(version));

const getMinor = version => npm.getMinor(composer2npm(version));

const getPatch = version => npm.getPatch(composer2npm(version));

const isGreaterThan = (a, b) =>
  npm.isGreaterThan(composer2npm(a), composer2npm(b));

const isLessThanRange = (version, range) =>
  npm.isLessThanRange(composer2npm(version), composer2npm(range));

const isSingleVersion = input => npm.isSingleVersion(composer2npm(input));

const isStable = version => npm.isStable(composer2npm(version));

const isValid = input => npm.isValid(composer2npm(input));

const isVersion = input => npm.isVersion(composer2npm(input));

const matches = (version, range) =>
  npm.matches(composer2npm(version), composer2npm(range));

const maxSatisfyingVersion = (versions, range) =>
  npm.maxSatisfyingVersion(versions.map(composer2npm), composer2npm(range));

const minSatisfyingVersion = (versions, range) =>
  npm.minSatisfyingVersion(versions.map(composer2npm), composer2npm(range));

function getNewValue(currentValue, rangeStrategy, fromVersion, toVersion) {
  const toMajor = getMajor(toVersion);
  const toMinor = getMinor(toVersion);
  let newValue;
  if (isVersion(currentValue)) {
    newValue = toVersion;
  } else if (
    npm.isVersion(padZeroes(toVersion)) &&
    npm.isValid(currentValue) &&
    composer2npm(currentValue) === currentValue
  ) {
    newValue = npm.getNewValue(
      currentValue,
      rangeStrategy,
      fromVersion,
      padZeroes(toVersion)
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
    if (fromVersion && toMajor > getMajor(fromVersion)) {
      newValue = `~${toMajor}.0`;
    } else {
      newValue = `~${toMajor}.${toMinor}`;
    }
  }
  if (currentValue.includes(' || ')) {
    const lastValue = currentValue
      .split('||')
      .pop()
      .trim();
    const replacementValue = getNewValue(
      lastValue,
      rangeStrategy,
      fromVersion,
      toVersion
    );
    if (rangeStrategy === 'replace') {
      newValue = replacementValue;
    } else if (rangeStrategy === 'widen') {
      newValue = currentValue + ' || ' + replacementValue;
    }
  }
  if (!newValue) {
    logger.warn(
      { currentValue, rangeStrategy, fromVersion, toVersion },
      'Unsupported composer value'
    );
    newValue = toVersion;
  }
  if (currentValue.split('.')[0].includes('v')) {
    newValue = newValue.replace(/([0-9])/, 'v$1');
  }
  return newValue;
}

function sortVersions(a, b) {
  return npm.sortVersions(composer2npm(a), composer2npm(b));
}

module.exports = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isCompatible: isVersion,
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
