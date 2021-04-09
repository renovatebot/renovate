import { parseRange } from 'semver-utils';
import { logger } from '../../logger';
import { api as npm } from '../npm';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'poetry';
export const displayName = 'Poetry';
export const urls = ['https://python-poetry.org/docs/versions/'];
export const supportsRanges = true;
export const supportedRangeStrategies = ['bump', 'extend', 'pin', 'replace'];

function notEmpty(s: string): boolean {
  return s !== '';
}

function getVersionParts(input: string): [string, string] {
  const versionParts = input.split('-');
  if (versionParts.length === 1) {
    return [input, ''];
  }

  return [versionParts[0], '-' + versionParts[1]];
}

function padZeroes(input: string): string {
  if (/[~^*]/.test(input)) {
    // ignore ranges
    return input;
  }

  const [output, stability] = getVersionParts(input);

  const sections = output.split('.');
  while (sections.length < 3) {
    sections.push('0');
  }
  return sections.join('.') + stability;
}

// This function works like cargo2npm, but it doesn't
// add a '^', because poetry treats versions without operators as
// exact versions.
function poetry2npm(input: string): string {
  return input
    .split(',')
    .map((str) => str.trim())
    .filter(notEmpty)
    .join(' ');
}

// NOTE: This function is copied from cargo versioning code.
// Poetry uses commas (like in cargo) instead of spaces (like in npm)
// for AND operation.
function npm2poetry(input: string): string {
  // Note: this doesn't remove the ^
  const res = input
    .split(' ')
    .map((str) => str.trim())
    .filter(notEmpty);
  const operators = ['^', '~', '=', '>', '<', '<=', '>='];
  for (let i = 0; i < res.length - 1; i += 1) {
    if (operators.includes(res[i])) {
      const newValue = res[i] + ' ' + res[i + 1];
      res.splice(i, 2, newValue);
    }
  }
  return res.join(', ').replace(/\s*,?\s*\|\|\s*,?\s*/, ' || ');
}

const equals = (a: string, b: string): boolean =>
  npm.equals(padZeroes(a), padZeroes(b));

const getMajor = (version: string): number => npm.getMajor(padZeroes(version));

const getMinor = (version: string): number => npm.getMinor(padZeroes(version));

const getPatch = (version: string): number => npm.getPatch(padZeroes(version));

const isGreaterThan = (a: string, b: string): boolean =>
  npm.isGreaterThan(padZeroes(a), padZeroes(b));

const isLessThanRange = (version: string, range: string): boolean =>
  npm.isLessThanRange(padZeroes(version), poetry2npm(range));

export const isValid = (input: string): string | boolean =>
  npm.isValid(poetry2npm(input));

const isStable = (version: string): boolean =>
  version && npm.isStable(padZeroes(version));

const isVersion = (input: string): string | boolean =>
  npm.isVersion(padZeroes(input));
const matches = (version: string, range: string): boolean =>
  npm.matches(version, poetry2npm(range));

const getSatisfyingVersion = (versions: string[], range: string): string =>
  npm.getSatisfyingVersion(versions, poetry2npm(range));

const minSatisfyingVersion = (versions: string[], range: string): string =>
  npm.minSatisfyingVersion(versions, poetry2npm(range));

const isSingleVersion = (constraint: string): string | boolean =>
  (constraint.trim().startsWith('=') &&
    isVersion(constraint.trim().substring(1).trim())) ||
  isVersion(constraint.trim());

function handleShort(
  operator: string,
  currentValue: string,
  newVersion: string
): string {
  const toVersionMajor = getMajor(newVersion);
  const toVersionMinor = getMinor(newVersion);
  const split = currentValue.split('.');
  if (split.length === 1) {
    // [^,~]4
    return `${operator}${toVersionMajor}`;
  }
  if (split.length === 2) {
    // [^,~]4.1
    return `${operator}${toVersionMajor}.${toVersionMinor}`;
  }
  return null;
}

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string {
  if (rangeStrategy === 'replace') {
    const npmCurrentValue = poetry2npm(currentValue);
    try {
      const massagedNewVersion = padZeroes(newVersion);
      if (
        npm.isVersion(massagedNewVersion) &&
        npm.matches(massagedNewVersion, npmCurrentValue)
      ) {
        return currentValue;
      }
    } catch (err) /* istanbul ignore next */ {
      logger.info(
        { err },
        'Poetry versioning: Error caught checking if newVersion satisfies currentValue'
      );
    }
    const parsedRange = parseRange(npmCurrentValue);
    const element = parsedRange[parsedRange.length - 1];
    if (parsedRange.length === 1 && element.operator) {
      if (element.operator === '^') {
        const version = handleShort('^', npmCurrentValue, newVersion);
        if (version) {
          return npm2poetry(version);
        }
      }
      if (element.operator === '~') {
        const version = handleShort('~', npmCurrentValue, newVersion);
        if (version) {
          return npm2poetry(version);
        }
      }
    }
  }
  const newSemver = npm.getNewValue({
    currentValue: poetry2npm(currentValue),
    rangeStrategy,
    currentVersion,
    newVersion,
  });
  const newPoetry = npm2poetry(newSemver);
  return newPoetry;
}

function sortVersions(a: string, b: string): number {
  return npm.sortVersions(padZeroes(a), padZeroes(b));
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  getNewValue,
  getSatisfyingVersion,
  isCompatible: isVersion,
  isGreaterThan,
  isLessThanRange,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  minSatisfyingVersion,
  sortVersions,
};
export default api;
