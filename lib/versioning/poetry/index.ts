import { parseRange } from 'semver-utils';
import { major, minor } from 'semver';
import { api as npm } from '../npm';
import { api as pep440 } from '../pep440';
import { NewValueConfig, VersioningApi } from '../common';
import { logger } from '../../logger';

function notEmpty(s: string): boolean {
  return s !== '';
}

// This function works like cargo2npm, but it doesn't
// add a '^', because poetry treats versions without operators as
// exact versions.
function poetry2npm(input: string): string {
  const versions = input
    .split(',')
    .map(str => str.trim())
    .filter(notEmpty);
  return versions.join(' ');
}

// NOTE: This function is copied from cargo versionsing code.
// Poetry uses commas (like in cargo) instead of spaces (like in npm)
// for AND operation.
function npm2poetry(input: string): string {
  // Note: this doesn't remove the ^
  const res = input
    .split(' ')
    .map(str => str.trim())
    .filter(notEmpty);
  const operators = ['^', '~', '=', '>', '<', '<=', '>='];
  for (let i = 0; i < res.length - 1; i += 1) {
    if (operators.includes(res[i])) {
      const newValue = res[i] + ' ' + res[i + 1];
      res.splice(i, 2, newValue);
    }
  }
  return res.join(', ');
}

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
    return operator + toVersionMajor;
  }
  if (split.length === 2) {
    // [^,~]4.1
    return operator + toVersionMajor + '.' + toVersionMinor;
  }
  return null;
}

// validation
function isCompatible(
  version: string,
  range?: string
): string | boolean | null {
  logger.trace(`poetry.isCompatible('${version}', '${range}') === ???`);
  const result = pep440.isValid(version)
    ? pep440.isCompatible(version, range)
    : npm.isCompatible(poetry2npm(version), range);
  logger.trace(`poetry.isCompatible('${version}', '${range}') === ${result}`);
  return result;
}

function isStable(version: string): boolean {
  logger.trace(`poetry.isStable('${version}') === ???`);
  const result = pep440.isValid(version)
    ? pep440.isStable(version)
    : npm.isStable(poetry2npm(version));
  logger.trace(`poetry.isStable('${version}') === ${result}`);
  return result;
}

export function isValid(input: string): string | boolean {
  logger.trace(`poetry.isValid('${input}') === ???`);
  const result = pep440.isValid(input)
    ? pep440.isValid(input)
    : npm.isValid(poetry2npm(input));
  logger.trace(`poetry.isValid('${input}') === ${result}`);
  return result;
}

function isVersion(input: string): string | boolean {
  logger.trace(`poetry.isVersion('${input}') === ???`);
  const result = !!(
    pep440.isVersion(input) || npm.isVersion(poetry2npm(input))
  );
  logger.trace(`poetry.isVersion('${input}') === ${result}`);
  return result;
}

function isSingleVersion(constraint: string): string | boolean {
  logger.trace(`poetry.isSingleVersion('${constraint}') === ???`);
  const c = constraint.trim();
  let result = false;
  if (pep440.isVersion(c)) {
    result = true;
  } else if (c.startsWith('=') && npm.isVersion(c.substring(1).trim())) {
    result = true;
  }
  logger.trace(`poetry.isSingleVersion('${constraint}') === ${result}`);
  return result;
}

// digestion of version

function getMajor(version: string): null | number {
  logger.trace(`poetry.getMajor('${version}') === ???`);
  let result = null;
  const npmVersion = poetry2npm(version);
  if (pep440.isValid(version)) {
    result = pep440.getMajor(version);
  } else if (npm.isValid(npmVersion)) {
    result = npm.getMajor(npmVersion);
  }
  logger.trace(`poetry.getMajor('${version}') === ${result}`);
  return result;
}

function getMinor(version: string): null | number {
  logger.trace(`poetry.getMinor('${version}') === ???`);
  const npmVersion = poetry2npm(version);
  let result = null;
  if (pep440.isValid(version)) {
    result = pep440.getMinor(version);
  } else if (npm.isValid(npmVersion)) {
    result = npm.getMinor(npmVersion);
  }
  logger.trace(`poetry.getMinor('${version}') === ${result}`);
  return result;
}

function getPatch(version: string): null | number {
  logger.trace(`poetry.getPatch('${version}') === ???`);
  const npmVersion = poetry2npm(version);
  let result = null;
  if (pep440.isValid(version)) {
    result = pep440.getPatch(version);
  } else if (npm.isValid(npmVersion)) {
    result = npm.getPatch(npmVersion);
  }
  logger.trace(`poetry.getPatch('${version}') === ${result}`);
  return result;
}

// comparison

function equals(version: string, other: string): boolean {
  logger.trace(`poetry.equals('${version}', '${other}') === ???`);
  const npmVersion = poetry2npm(version);
  const npmOther = poetry2npm(other);
  let result = false;
  if (pep440.isValid(version) && pep440.isValid(other)) {
    result = pep440.equals(version, other);
  } else if (npm.isValid(npmVersion) && npm.isValid(npmOther)) {
    result = npm.equals(npmVersion, npmOther);
  }
  logger.trace(`poetry.equals('${version}', '${other}') === ${result}`);
  return result;
}

function isGreaterThan(version: string, other: string): boolean {
  logger.trace(`poetry.isGreaterThan('${version}', '${other}') === ???`);
  const npmVersion = poetry2npm(version);
  const npmOther = poetry2npm(other);
  let result = false;
  if (pep440.isValid(version) && pep440.isValid(other)) {
    result = pep440.isGreaterThan(version, other);
  } else if (npm.isValid(npmVersion) && npm.isValid(npmOther)) {
    result = npm.isGreaterThan(npmVersion, npmOther);
  }
  logger.trace(`poetry.isGreaterThan('${version}', '${other}') === ${result}`);
  return result;
}

function isLessThanRange(version: string, range: string): boolean {
  logger.trace(`poetry.isLessThanRange('${version}', '${range}') === ???`);
  const npmVersion = poetry2npm(version);
  const npmRange = poetry2npm(range);
  let result = false;
  if (pep440.isValid(version) && pep440.isValid(range)) {
    result = pep440.isLessThanRange(version, range);
  } else if (npm.isValid(npmVersion) && npm.isValid(npmRange)) {
    result = npm.isLessThanRange(npmVersion, npmRange);
  }
  logger.trace(
    `poetry.isLessThanRange('${version}', '${range}') === ${result}`
  );
  return result;
}

function maxSatisfyingVersion(versions: string[], range: string): string {
  logger.trace(
    `poetry.maxSatisfyingVersion([${versions}], '${range}') === ???`
  );
  const npmRange = poetry2npm(range);
  const result = pep440.isValid(npmRange)
    ? pep440.maxSatisfyingVersion(versions, range)
    : npm.maxSatisfyingVersion(versions, npmRange);
  logger.trace(
    `poetry.maxSatisfyingVersion([${versions}], '${range}') === ${result}`
  );
  return result;
}

function minSatisfyingVersion(versions: string[], range: string): string {
  logger.trace(
    `poetry.minSatisfyingVersion([${versions}], '${range}') === ???`
  );
  const npmRange = poetry2npm(range);
  const result = pep440.isValid(npmRange)
    ? pep440.minSatisfyingVersion(versions, range)
    : npm.minSatisfyingVersion(versions, npmRange);
  logger.trace(
    `poetry.minSatisfyingVersion([${versions}], '${range}') === ${result}`
  );
  return result;
}

function getNewValue(newValueConfig: NewValueConfig): string {
  try {
    const {
      currentValue,
      rangeStrategy,
      fromVersion,
      toVersion,
    } = newValueConfig;
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
  } catch (_) {
    return pep440.getNewValue(newValueConfig);
  }
}

function sortVersions(version: string, other: string): number {
  logger.trace(`poetry.sortVersions('${version}', '${other}') === ???`);
  const npmVersion = poetry2npm(version);
  const npmOther = poetry2npm(other);
  let result = 0;
  if (pep440.isValid(version) && pep440.isValid(other)) {
    result = pep440.sortVersions(version, other);
  } else if (npm.isValid(npmVersion) && npm.isValid(npmOther)) {
    result = npm.sortVersions(npmVersion, npmOther);
  } // else throw?
  logger.trace(`poetry.sortVersions('${version}', '${other}') === ${result}`);
  return result;
}

function matches(version: string, range: string): boolean {
  logger.trace(`poetry.matches('${version}', '${range}') === ???`);
  const npmVersion = poetry2npm(version);
  const npmRange = poetry2npm(range);
  let result = false;
  if (pep440.isValid(version) && pep440.isValid(range)) {
    result = pep440.matches(version, range);
  } else if (npm.isValid(npmVersion) && npm.isValid(npmRange)) {
    result = npm.matches(npmVersion, npmRange);
  }
  logger.trace(`poetry.matches('${version}', '${range}') === ${result}`);
  return result;
}

export const api: VersioningApi = {
  isCompatible,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,

  getMajor,
  getMinor,
  getPatch,

  equals,
  isGreaterThan,
  isLessThanRange,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,

  matches,
};
export default api;
