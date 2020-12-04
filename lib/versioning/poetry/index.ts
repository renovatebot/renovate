import { major, minor } from 'semver';
import { parseRange } from 'semver-utils';
import { NewValueConfig, VersioningApi } from '../common';
import { api as npm } from '../npm';

export const id = 'poetry';
export const displayName = 'Poetry';
export const urls = ['https://python-poetry.org/docs/versions/'];
export const supportsRanges = true;
export const supportedRangeStrategies = ['bump', 'extend', 'pin', 'replace'];

function notEmpty(s: string): boolean {
  return s !== '';
}

// This function works like cargo2npm, but it doesn't
// add a '^', because poetry treats versions without operators as
// exact versions.
function poetry2npm(input: string): string {
  const versions = input
    .split(',')
    .map((str) => str.trim())
    .filter(notEmpty);
  return versions.join(' ');
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

const isLessThanRange = (version: string, range: string): boolean =>
  npm.isLessThanRange(version, poetry2npm(range));

export const isValid = (input: string): string | boolean =>
  npm.isValid(poetry2npm(input));

const isVersion = (input: string): string | boolean => npm.isVersion(input);
const matches = (version: string, range: string): boolean =>
  npm.matches(version, poetry2npm(range));

const maxSatisfyingVersion = (versions: string[], range: string): string =>
  npm.maxSatisfyingVersion(versions, poetry2npm(range));

const minSatisfyingVersion = (versions: string[], range: string): string =>
  npm.minSatisfyingVersion(versions, poetry2npm(range));

const isSingleVersion = (constraint: string): string | boolean =>
  (constraint.trim().startsWith('=') &&
    isVersion(constraint.trim().substring(1).trim())) ||
  isVersion(constraint.trim());

function handleShort(
  operator: string,
  currentValue: string,
  toVersion: string
): string {
  const toVersionMajor = major(toVersion);
  const toVersionMinor = minor(toVersion);
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
  fromVersion,
  toVersion,
}: NewValueConfig): string {
  if (rangeStrategy === 'replace') {
    const npmCurrentValue = poetry2npm(currentValue);
    const parsedRange = parseRange(npmCurrentValue);
    const element = parsedRange[parsedRange.length - 1];
    if (parsedRange.length === 1 && element.operator) {
      if (element.operator === '^') {
        const version = handleShort('^', npmCurrentValue, toVersion);
        if (version) {
          return npm2poetry(version);
        }
      }
      if (element.operator === '~') {
        const version = handleShort('~', npmCurrentValue, toVersion);
        if (version) {
          return npm2poetry(version);
        }
      }
    }
  }
  const newSemver = npm.getNewValue({
    currentValue: poetry2npm(currentValue),
    rangeStrategy,
    fromVersion,
    toVersion,
  });
  const newPoetry = npm2poetry(newSemver);
  return newPoetry;
}

export const api: VersioningApi = {
  ...npm,
  getNewValue,
  isLessThanRange,
  isSingleVersion,
  isValid,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
};
export default api;
