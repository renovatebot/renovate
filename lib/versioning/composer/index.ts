import { coerce } from 'semver';
import { logger } from '../../logger';
import { api as npm } from '../npm';
import { VersioningApi, NewValueConfig } from '../common';

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

function removeLeadingV(input: string): string {
  return input.replace(/^v/i, '');
}

function convertStabilitiyModifier(input: string): string {
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

  return versionParts[0] + '-' + stability;
}

function composer2npm(input: string): string {
  const cleanInput = convertStabilitiyModifier(removeLeadingV(input));
  if (npm.isVersion(cleanInput)) {
    return cleanInput;
  }
  if (npm.isVersion(padZeroes(cleanInput))) {
    return padZeroes(cleanInput);
  }
  let [output, stability] = getVersionParts(cleanInput);

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

const maxSatisfyingVersion = (versions: string[], range: string): string =>
  npm.maxSatisfyingVersion(versions.map(composer2npm), composer2npm(range));

const minSatisfyingVersion = (versions: string[], range: string): string =>
  npm.minSatisfyingVersion(versions.map(composer2npm), composer2npm(range));

function getNewValue({
  currentValue,
  rangeStrategy,
  fromVersion,
  toVersion,
}: NewValueConfig): string {
  if (rangeStrategy === 'pin') {
    return toVersion;
  }
  const toMajor = getMajor(toVersion);
  const toMinor = getMinor(toVersion);
  let newValue: string;
  if (isVersion(currentValue)) {
    newValue = toVersion;
  } else if (
    npm.isVersion(padZeroes(toVersion)) &&
    npm.isValid(currentValue) &&
    composer2npm(currentValue) === removeLeadingV(currentValue)
  ) {
    newValue = npm.getNewValue({
      currentValue,
      rangeStrategy,
      fromVersion,
      toVersion: padZeroes(toVersion),
    });
  } else if (/^~(0\.[1-9][0-9]*)$/.test(currentValue)) {
    // handle ~0.4 case first
    if (toMajor === 0) {
      newValue = `~0.${toMinor}`;
    } else {
      newValue = `~${toMajor}.0`;
    }
  } else if (/^~([0-9]*)$/.test(currentValue)) {
    // handle ~4 case
    newValue = `~${toMajor}`;
  } else if (/^~([0-9]*(?:\.[0-9]*)?)$/.test(currentValue)) {
    // handle ~4.1 case
    if (fromVersion && toMajor > getMajor(fromVersion)) {
      newValue = `~${toMajor}.0`;
    } else {
      newValue = `~${toMajor}.${toMinor}`;
    }
  }
  if (currentValue.includes(' || ')) {
    const lastValue = currentValue.split('||').pop().trim();
    const replacementValue = getNewValue({
      currentValue: lastValue,
      rangeStrategy,
      fromVersion,
      toVersion,
    });
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
  maxSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,
};
export default api;
