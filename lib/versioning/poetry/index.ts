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

function equals(a: string, b: string): boolean {
  return npm.equals(padZeroes(a), padZeroes(b));
}

function getMajor(version: string): number {
  return npm.getMajor(padZeroes(version));
}

function getMinor(version: string): number {
  return npm.getMinor(padZeroes(version));
}

function getPatch(version: string): number {
  return npm.getPatch(padZeroes(version));
}

function isGreaterThan(a: string, b: string): boolean {
  return npm.isGreaterThan(padZeroes(a), padZeroes(b));
}

function isLessThanRange(version: string, range: string): boolean {
  return (
    npm.isVersion(padZeroes(version)) &&
    npm.isLessThanRange(padZeroes(version), poetry2npm(range))
  );
}

export function isValid(input: string): string | boolean {
  return npm.isValid(poetry2npm(input));
}

function isStable(version: string): boolean {
  return npm.isStable(padZeroes(version));
}

function isVersion(input: string): string | boolean {
  return npm.isVersion(padZeroes(input));
}

function matches(version: string, range: string): boolean {
  return (
    npm.isVersion(padZeroes(version)) &&
    npm.matches(padZeroes(version), poetry2npm(range))
  );
}

function getSatisfyingVersion(versions: string[], range: string): string {
  return npm.getSatisfyingVersion(versions, poetry2npm(range));
}

function minSatisfyingVersion(versions: string[], range: string): string {
  return npm.minSatisfyingVersion(versions, poetry2npm(range));
}

function isSingleVersion(constraint: string): string | boolean {
  return (
    (constraint.trim().startsWith('=') &&
      isVersion(constraint.trim().substring(1).trim())) ||
    isVersion(constraint.trim())
  );
}

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
