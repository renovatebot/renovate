import { coerce } from 'semver';
import { logger } from '../../logger';
import { api as npm } from '../npm';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'composer';
export const displayName = 'Composer';
export const urls = [
  'https://getcomposer.org/doc/articles/versions.md',
  'https://packagist.org/packages/composer/semver',
  'https://madewithlove.be/tilde-and-caret-constraints/',
  'https://semver.mwl.be',
];
export const supportsRanges = true;
export const supportedRangeStrategies = ['bump', 'extend', 'pin', 'replace'];

function getVersionParts(input: string): [string, string] {
  const versionParts = input.split('-');
  if (versionParts.length === 1) {
    return [input, ''];
  }

  return [versionParts[0], '-' + versionParts[1]];
}

function padZeroes(input: string): string {
  const [output, stability] = getVersionParts(input);

  const sections = output.split('.');
  while (sections.length < 3) {
    sections.push('0');
  }
  return sections.join('.') + stability;
}

function convertStabilityModifier(input: string): string {
  // Handle stability modifiers.
  const versionParts = input.split('@');
  if (versionParts.length === 1) {
    return input;
  }

  // 1.0@beta2 to 1.0-beta.2
  const stability = versionParts[1].replace(
    /(?:^|\s)(beta|alpha|rc)([1-9][0-9]*)(?: |$)/gi,
    '$1.$2'
  );

  // If there is a stability part, npm semver expects the version
  // to be full
  return padZeroes(versionParts[0]) + '-' + stability;
}

function normalizeVersion(input: string): string {
  let output = input;
  output = output.replace(/(^|>|>=|\^|~)v/i, '$1');
  return convertStabilityModifier(output);
}

function composer2npm(input: string): string {
  const cleanInput = normalizeVersion(input);
  if (npm.isVersion(cleanInput)) {
    return cleanInput;
  }
  if (npm.isVersion(padZeroes(cleanInput))) {
    return padZeroes(cleanInput);
  }
  const [versionId, stability] = getVersionParts(cleanInput);
  let output = versionId;

  // ~4 to ^4 and ~4.1 to ^4.1
  output = output.replace(/(?:^|\s)~([1-9][0-9]*(?:\.[0-9]*)?)(?: |$)/g, '^$1');
  // ~0.4 to >=0.4 <1
  output = output.replace(/(?:^|\s)~(0\.[1-9][0-9]*)(?: |$)/g, '>=$1 <1');

  return output + stability;
}

const equals = (a: string, b: string): boolean =>
  npm.equals(composer2npm(a), composer2npm(b));

const getMajor = (version: string): number =>
  npm.getMajor(coerce(composer2npm(version)));

const getMinor = (version: string): number =>
  npm.getMinor(coerce(composer2npm(version)));

const getPatch = (version: string): number =>
  npm.getPatch(coerce(composer2npm(version)));

const isGreaterThan = (a: string, b: string): boolean =>
  npm.isGreaterThan(composer2npm(a), composer2npm(b));

const isLessThanRange = (version: string, range: string): boolean =>
  npm.isLessThanRange(composer2npm(version), composer2npm(range));

const isSingleVersion = (input: string): string | boolean =>
  input && npm.isSingleVersion(composer2npm(input));

const isStable = (version: string): boolean =>
  version && npm.isStable(composer2npm(version));

export const isValid = (input: string): string | boolean =>
  input && npm.isValid(composer2npm(input));

export const isVersion = (input: string): string | boolean =>
  input && npm.isVersion(composer2npm(input));

const matches = (version: string, range: string): boolean =>
  npm.matches(composer2npm(version), composer2npm(range));

const getSatisfyingVersion = (versions: string[], range: string): string =>
  npm.getSatisfyingVersion(versions.map(composer2npm), composer2npm(range));

const minSatisfyingVersion = (versions: string[], range: string): string =>
  npm.minSatisfyingVersion(versions.map(composer2npm), composer2npm(range));

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string {
  if (rangeStrategy === 'pin') {
    return newVersion;
  }
  if (rangeStrategy === 'update-lockfile') {
    if (matches(newVersion, currentValue)) {
      return currentValue;
    }
    return getNewValue({
      currentValue,
      rangeStrategy: 'replace',
      currentVersion,
      newVersion,
    });
  }
  const toMajor = getMajor(newVersion);
  const toMinor = getMinor(newVersion);
  let newValue: string;
  if (isVersion(currentValue)) {
    newValue = newVersion;
  } else if (/^[~^](0\.[1-9][0-9]*)$/.test(currentValue)) {
    const operator = currentValue.substr(0, 1);
    // handle ~0.4 case first
    if (toMajor === 0) {
      newValue = `${operator}0.${toMinor}`;
    } else {
      newValue = `${operator}${toMajor}.0`;
    }
  } else if (/^[~^]([0-9]*)$/.test(currentValue)) {
    // handle ~4 case
    const operator = currentValue.substr(0, 1);
    newValue = `${operator}${toMajor}`;
  } else if (/^[~^]([0-9]*(?:\.[0-9]*)?)$/.test(currentValue)) {
    const operator = currentValue.substr(0, 1);
    // handle ~4.1 case
    if (currentVersion && toMajor > getMajor(currentVersion)) {
      newValue = `${operator}${toMajor}.0`;
    } else {
      newValue = `${operator}${toMajor}.${toMinor}`;
    }
  } else if (
    npm.isVersion(padZeroes(normalizeVersion(newVersion))) &&
    npm.isValid(normalizeVersion(currentValue)) &&
    composer2npm(currentValue) === normalizeVersion(currentValue)
  ) {
    newValue = npm.getNewValue({
      currentValue: normalizeVersion(currentValue),
      rangeStrategy,
      currentVersion: normalizeVersion(currentVersion),
      newVersion: padZeroes(normalizeVersion(newVersion)),
    });
  }
  if (currentValue.includes(' || ')) {
    const lastValue = currentValue.split('||').pop().trim();
    const replacementValue = getNewValue({
      currentValue: lastValue,
      rangeStrategy,
      currentVersion,
      newVersion,
    });
    if (rangeStrategy === 'replace') {
      newValue = replacementValue;
    } else if (rangeStrategy === 'widen') {
      newValue = currentValue + ' || ' + replacementValue;
    }
  }
  if (!newValue) {
    logger.warn(
      { currentValue, rangeStrategy, currentVersion, newVersion },
      'Unsupported composer value'
    );
    newValue = newVersion;
  }
  if (currentValue.split('.')[0].includes('v')) {
    newValue = newValue.replace(/([0-9])/, 'v$1');
  }

  // Preserve original min-stability specifier
  if (currentValue.includes('@')) {
    newValue += '@' + currentValue.split('@')[1];
  }

  return newValue;
}

function sortVersions(a: string, b: string): number {
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
  getSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,
};
export default api;
