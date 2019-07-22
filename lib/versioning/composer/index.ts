import { coerce } from 'semver';
import { logger } from '../../logger';
import npm, { isVersion as _isVersion, isValid as _isValid } from '../npm';
import { VersioningApi, RangeStrategy } from '../common';

function padZeroes(input: string) {
  const sections = input.split('.');
  while (sections.length < 3) {
    sections.push('0');
  }
  return sections.join('.');
}

function composer2npm(input: string) {
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

const equals = (a: string, b: string) =>
  npm.equals(composer2npm(a), composer2npm(b));

const getMajor = (version: string) =>
  npm.getMajor(coerce(composer2npm(version)));

const getMinor = (version: string) =>
  npm.getMinor(coerce(composer2npm(version)));

const getPatch = (version: string) =>
  npm.getPatch(coerce(composer2npm(version)));

const isGreaterThan = (a: string, b: string) =>
  npm.isGreaterThan(composer2npm(a), composer2npm(b));

const isLessThanRange = (version: string, range: string) =>
  npm.isLessThanRange(composer2npm(version), composer2npm(range));

const isSingleVersion = (input: string) =>
  input && npm.isSingleVersion(composer2npm(input));

const isStable = (version: string) =>
  version && npm.isStable(composer2npm(version));

export const isValid = (input: string) =>
  input && _isValid(composer2npm(input));

export const isVersion = (input: string) =>
  input && _isVersion(composer2npm(input));

const matches = (version: string, range: string) =>
  npm.matches(composer2npm(version), composer2npm(range));

const maxSatisfyingVersion = (versions: string[], range: string) =>
  npm.maxSatisfyingVersion(versions.map(composer2npm), composer2npm(range));

const minSatisfyingVersion = (versions: string[], range: string) =>
  npm.minSatisfyingVersion(versions.map(composer2npm), composer2npm(range));

function getNewValue(
  currentValue: string,
  rangeStrategy: RangeStrategy,
  fromVersion: string,
  toVersion: string
) {
  if (rangeStrategy === 'pin') {
    return toVersion;
  }
  const toMajor = getMajor(toVersion);
  const toMinor = getMinor(toVersion);
  let newValue: string;
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

function sortVersions(a: string, b: string) {
  return npm.sortVersions(composer2npm(a), composer2npm(b));
}

export const api: VersioningApi = {
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
