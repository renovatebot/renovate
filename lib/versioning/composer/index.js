import { coerce } from 'semver';
import { logger } from '../../logger';
import npm, { isVersion as _isVersion, isValid as _isValid } from '../npm';

function padZeroes(input) {
  const sections = input.split('.');
  while (sections.length < 3) {
    sections.push('0');
  }
  return sections.join('.');
}

function composer2npm(input) {
  if (_isVersion(input)) {
    return input;
  }
  if (_isVersion(padZeroes(input))) {
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

const getMajor = version => npm.getMajor(coerce(composer2npm(version)));

const getMinor = version => npm.getMinor(coerce(composer2npm(version)));

const getPatch = version => npm.getPatch(coerce(composer2npm(version)));

const isGreaterThan = (a, b) =>
  npm.isGreaterThan(composer2npm(a), composer2npm(b));

const isLessThanRange = (version, range) =>
  npm.isLessThanRange(composer2npm(version), composer2npm(range));

const isSingleVersion = input =>
  input && npm.isSingleVersion(composer2npm(input));

const isStable = version => version && npm.isStable(composer2npm(version));

export const isValid = input => input && _isValid(composer2npm(input));

export const isVersion = input => input && _isVersion(composer2npm(input));

const matches = (version, range) =>
  npm.matches(composer2npm(version), composer2npm(range));

/** @type any */
const maxSatisfyingVersion = (versions, range) =>
  npm.maxSatisfyingVersion(versions.map(composer2npm), composer2npm(range));

/** @type any */
const minSatisfyingVersion = (versions, range) =>
  npm.minSatisfyingVersion(versions.map(composer2npm), composer2npm(range));

function getNewValue(currentValue, rangeStrategy, fromVersion, toVersion) {
  if (rangeStrategy === 'pin') {
    return toVersion;
  }
  const toMajor = getMajor(toVersion);
  const toMinor = getMinor(toVersion);
  let newValue;
  if (isVersion(currentValue)) {
    newValue = toVersion;
  } else if (
    _isVersion(padZeroes(toVersion)) &&
    _isValid(currentValue) &&
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

/** @type import('../common').VersioningApi */
export const api = {
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
export default api;
