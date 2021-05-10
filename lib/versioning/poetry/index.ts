import { parseRange } from 'semver-utils';
import { logger } from '../../logger';
import * as memCache from '../../util/cache/memory';
import { api as npm } from '../npm';
import { api as pep440 } from '../pep440';
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

function toNpmVersion(input: string): string {
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
  const cacheKey = `poetry2npm:${input}`;
  let result = memCache.get<string | null>(cacheKey);
  if (result === undefined) {
    result = input
      .split(',')
      .map((str) => str.trim())
      .filter(notEmpty)
      .join(' ');
  }
  return result;
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

function toNpmRange(input: string): string | null {
  const cacheKey = `getNpmRange:${input}`;
  let result = memCache.get<string | null>(cacheKey);
  if (result === undefined) {
    result =
      !pep440.isValid(input) && npm.isValid(input) && !npm.isVersion(input)
        ? poetry2npm(input)
        : null;
    result = result && npm.isValid(result) ? result : null;
    memCache.set(cacheKey, result);
  }
  return result;
}

export function isValid(input: string): string | boolean {
  if (pep440.isValid(input)) {
    return true;
  }
  if (toNpmRange(input)) {
    return true;
  }
  return false;
}

function isLessThanRange(version: string, range: string): boolean {
  const npmRange = toNpmRange(range);
  if (!npmRange) {
    return pep440.isLessThanRange(version, range);
  }

  const npmVersion = toNpmVersion(version);
  return npm.isVersion(npmVersion) && npm.isLessThanRange(npmVersion, npmRange);
}

function matches(version: string, range: string): boolean {
  const npmRange = toNpmRange(range);
  if (!npmRange) {
    return pep440.matches(version, range);
  }

  const npmVersion = toNpmVersion(version);
  return npm.isVersion(npmVersion) && npm.matches(npmVersion, npmRange);
}

function getSatisfyingVersion(versions: string[], range: string): string {
  const npmRange = toNpmRange(range);
  if (!npmRange) {
    return pep440.getSatisfyingVersion(versions, range);
  }

  return npm.getSatisfyingVersion(versions, npmRange);
}

function minSatisfyingVersion(versions: string[], range: string): string {
  const npmRange = toNpmRange(range);
  if (!npmRange) {
    return pep440.minSatisfyingVersion(versions, range);
  }

  return npm.minSatisfyingVersion(versions, npmRange);
}

function handleShort(
  operator: string,
  currentValue: string,
  newVersion: string
): string {
  const npmNewVersion = toNpmVersion(newVersion);
  const toVersionMajor = npm.getMajor(npmNewVersion);
  const toVersionMinor = npm.getMinor(npmNewVersion);
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

function getNewValue(config: NewValueConfig): string {
  const { currentValue, rangeStrategy, currentVersion, newVersion } = config;
  const npmRange = toNpmRange(currentValue);
  if (!npmRange) {
    return pep440.getNewValue(config);
  }
  if (rangeStrategy === 'replace') {
    const npmCurrentValue = npmRange;
    try {
      const massagedNewVersion = toNpmVersion(newVersion);
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
    currentValue: npmRange,
    rangeStrategy,
    currentVersion,
    newVersion,
  });
  const newPoetry = npm2poetry(newSemver);
  return newPoetry;
}

export const api: VersioningApi = {
  ...pep440,
  isValid,
  matches,
  getNewValue,
  getSatisfyingVersion,
  isLessThanRange,
  minSatisfyingVersion,
};
export default api;
