import is from '@sindresorhus/is';
import semver from 'semver';
import { parseRange } from 'semver-utils';
import { logger } from '../../../logger';
import type { RangeStrategy } from '../../../types/versioning';
import { regEx } from '../../../util/regex';
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
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'widen',
  'pin',
  'replace',
  'update-lockfile',
];

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
    regEx(/(?:^|\s)(beta|alpha|rc)([1-9][0-9]*)(?: |$)/gi),
    '$1.$2'
  );

  // If there is a stability part, npm semver expects the version
  // to be full
  return padZeroes(versionParts[0]) + '-' + stability;
}

function normalizeVersion(input: string): string {
  let output = input;
  output = output.replace(regEx(/(^|>|>=|\^|~)v/i), '$1');
  return convertStabilityModifier(output);
}

function composer2npm(input: string): string {
  return input
    .split(regEx(/\s*\|\|?\s*/g))
    .map((part): string => {
      const cleanInput = normalizeVersion(part);
      if (npm.isVersion(cleanInput)) {
        return cleanInput;
      }
      if (npm.isVersion(padZeroes(cleanInput))) {
        return padZeroes(cleanInput);
      }
      const [versionId, stability] = getVersionParts(cleanInput);
      let output = versionId;

      // ~4 to ^4 and ~4.1 to ^4.1
      output = output.replace(
        regEx(/(?:^|\s)~([1-9][0-9]*(?:\.[0-9]*)?)(?: |$)/g),
        '^$1'
      );
      // ~0.4 to >=0.4 <1
      output = output.replace(
        regEx(/(?:^|\s)~(0\.[1-9][0-9]*)(?: |$)/g),
        '>=$1 <1'
      );

      // add extra digits to <8-DEV and <8.0-DEV
      output = output
        .replace(regEx(/^(<\d+(\.\d+)?)$/g), '$1.0')
        .replace(regEx(/^(<\d+(\.\d+)?)$/g), '$1.0');

      return output + stability;
    })
    .map((part) => part.replace(/([a-z])([0-9])/gi, '$1.$2'))
    .join(' || ');
}

function equals(a: string, b: string): boolean {
  return npm.equals(composer2npm(a), composer2npm(b));
}

function getMajor(version: string): number | null {
  const semverVersion = semver.coerce(composer2npm(version));
  return semverVersion ? npm.getMajor(semverVersion) : null;
}

function getMinor(version: string): number | null {
  const semverVersion = semver.coerce(composer2npm(version));
  return semverVersion ? npm.getMinor(semverVersion) : null;
}

function getPatch(version: string): number | null {
  const semverVersion = semver.coerce(composer2npm(version));
  return semverVersion ? npm.getPatch(semverVersion) : null;
}

function isGreaterThan(a: string, b: string): boolean {
  return npm.isGreaterThan(composer2npm(a), composer2npm(b));
}

function isLessThanRange(version: string, range: string): boolean {
  return !!npm.isLessThanRange?.(composer2npm(version), composer2npm(range));
}

function isSingleVersion(input: string): boolean {
  return !!input && npm.isSingleVersion(composer2npm(input));
}

function isStable(version: string): boolean {
  return !!(version && npm.isStable(composer2npm(version)));
}

export function isValid(input: string): boolean {
  return !!input && npm.isValid(composer2npm(input));
}

export function isVersion(input: string): boolean {
  return !!input && npm.isVersion(composer2npm(input));
}

function matches(version: string, range: string): boolean {
  return npm.matches(composer2npm(version), composer2npm(range));
}

function getSatisfyingVersion(
  versions: string[],
  range: string
): string | null {
  const npmVersions = versions.map(composer2npm);
  const npmVersion = npm.getSatisfyingVersion(npmVersions, composer2npm(range));
  if (!npmVersion) {
    return null;
  }
  // get index of npmVersion in npmVersions
  return versions[npmVersions.indexOf(npmVersion)] ?? npmVersion;
}

function minSatisfyingVersion(
  versions: string[],
  range: string
): string | null {
  const npmVersions = versions.map(composer2npm);
  const npmVersion = npm.minSatisfyingVersion(npmVersions, composer2npm(range));
  if (!npmVersion) {
    return null;
  }
  // get index of npmVersion in npmVersions
  return versions[npmVersions.indexOf(npmVersion)] ?? npmVersion;
}

function subset(subRange: string, superRange: string): boolean | undefined {
  try {
    return npm.subset!(composer2npm(subRange), composer2npm(superRange));
  } catch (err) {
    logger.trace({ err }, 'composer.subset error');
    return false;
  }
}

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string | null {
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
  const currentMajor = currentVersion ? getMajor(currentVersion) : null;
  const toMajor = getMajor(newVersion);
  const toMinor = getMinor(newVersion);
  let newValue: string | null = null;
  if (isVersion(currentValue)) {
    newValue = newVersion;
  } else if (regEx(/^[~^](0\.[1-9][0-9]*)$/).test(currentValue)) {
    const operator = currentValue.substring(0, 1);
    // handle ~0.4 case first
    if (toMajor === 0) {
      // TODO: types (#7154)
      newValue = `${operator}0.${toMinor!}`;
    } else {
      // TODO: types (#7154)
      newValue = `${operator}${toMajor!}.0`;
    }
  } else if (regEx(/^[~^]([0-9]*)$/).test(currentValue)) {
    // handle ~4 case
    const operator = currentValue.substring(0, 1);
    // TODO: types (#7154)
    newValue = `${operator}${toMajor!}`;
  } else if (
    toMajor &&
    regEx(/^[~^]([0-9]*(?:\.[0-9]*)?)$/).test(currentValue)
  ) {
    const operator = currentValue.substring(0, 1);
    if (rangeStrategy === 'bump') {
      newValue = `${operator}${newVersion}`;
    } else if (
      (is.number(currentMajor) && toMajor > currentMajor) ||
      !toMinor
    ) {
      // handle ~4.1 case
      newValue = `${operator}${toMajor}.0`;
    } else {
      newValue = `${operator}${toMajor}.${toMinor}`;
    }
  } else if (
    currentVersion &&
    npm.isVersion(padZeroes(normalizeVersion(newVersion))) &&
    npm.isValid(normalizeVersion(currentValue)) &&
    composer2npm(currentValue) === normalizeVersion(currentValue)
  ) {
    newValue = npm.getNewValue({
      currentValue: normalizeVersion(currentValue),
      rangeStrategy,
      currentVersion: padZeroes(normalizeVersion(currentVersion)),
      newVersion: padZeroes(normalizeVersion(newVersion)),
    });
  }

  if (rangeStrategy === 'widen' && matches(newVersion, currentValue)) {
    newValue = currentValue;
  } else {
    const hasOr = currentValue.includes(' || ');
    if (hasOr || rangeStrategy === 'widen') {
      const splitValues = currentValue.split('||');
      const lastValue = splitValues[splitValues.length - 1];
      const replacementValue = getNewValue({
        currentValue: lastValue.trim(),
        rangeStrategy: 'replace',
        currentVersion,
        newVersion,
      });
      if (rangeStrategy === 'replace') {
        newValue = replacementValue;
      } else if (replacementValue) {
        const parsedRange = parseRange(replacementValue);
        const element = parsedRange[parsedRange.length - 1];
        if (element.operator?.startsWith('<')) {
          const splitCurrent = currentValue.split(element.operator);
          splitCurrent.pop();
          newValue = splitCurrent.join(element.operator) + replacementValue;
        } else {
          newValue = currentValue + ' || ' + replacementValue;
        }
      }
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
    newValue = newValue.replace(regEx(/([0-9])/), 'v$1');
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

function isCompatible(version: string): boolean {
  return isVersion(version);
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isCompatible,
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
  subset,
};
export default api;
