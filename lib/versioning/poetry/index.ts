import { parseRange } from 'semver-utils';
import { logger } from '../../logger';
import { api as npm } from '../npm';
import type { NewValueConfig, VersioningApi } from '../types';
import { VERSION_PATTERN } from './patterns';
import {
  npm2poetry,
  poetry2npm,
  poetry2semver,
  semver2poetry,
} from './transform';

export const id = 'poetry';
export const displayName = 'Poetry';
export const urls = ['https://python-poetry.org/docs/versions/'];
export const supportsRanges = true;
export const supportedRangeStrategies = ['bump', 'extend', 'pin', 'replace'];

function equals(a: string, b: string): boolean {
  return npm.equals(poetry2semver(a), poetry2semver(b));
}

function getMajor(version: string): number {
  return npm.getMajor(poetry2semver(version));
}

function getMinor(version: string): number {
  return npm.getMinor(poetry2semver(version));
}

function getPatch(version: string): number {
  return npm.getPatch(poetry2semver(version));
}

function isVersion(input: string): boolean {
  return VERSION_PATTERN.test(input);
}

function isGreaterThan(a: string, b: string): boolean {
  return npm.isGreaterThan(poetry2semver(a), poetry2semver(b));
}

function isLessThanRange(version: string, range: string): boolean {
  return (
    isVersion(version) &&
    npm.isLessThanRange(poetry2semver(version), poetry2npm(range))
  );
}

export function isValid(input: string): boolean {
  return npm.isValid(poetry2npm(input));
}

function isStable(version: string): boolean {
  return npm.isStable(poetry2semver(version));
}

function matches(version: string, range: string): boolean {
  return (
    isVersion(version) && npm.matches(poetry2semver(version), poetry2npm(range))
  );
}

function getSatisfyingVersion(versions: string[], range: string): string {
  return semver2poetry(
    npm.getSatisfyingVersion(
      versions.map((version) => poetry2semver(version)),
      poetry2npm(range)
    )
  );
}

function minSatisfyingVersion(versions: string[], range: string): string {
  return semver2poetry(
    npm.minSatisfyingVersion(
      versions.map((version) => poetry2semver(version)),
      poetry2npm(range)
    )
  );
}

function isSingleVersion(constraint: string): boolean {
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
      const massagedNewVersion = poetry2semver(newVersion);
      if (
        isVersion(massagedNewVersion) &&
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

  // Explicitly check whether this is a fully-qualified version
  if (
    (VERSION_PATTERN.exec(newVersion)?.groups?.release || '').split('.')
      .length !== 3
  ) {
    logger.debug(
      'Cannot massage python version to npm - returning currentValue'
    );
    return currentValue;
  }
  try {
    const newSemver = npm.getNewValue({
      currentValue: poetry2npm(currentValue),
      rangeStrategy,
      currentVersion: poetry2semver(currentVersion),
      newVersion: poetry2semver(newVersion),
    });
    const newPoetry = npm2poetry(newSemver);
    return newPoetry;
  } catch (err) /* istanbul ignore next */ {
    logger.debug(
      { currentValue, rangeStrategy, currentVersion, newVersion, err },
      'Could not generate new value using npm.getNewValue()'
    );
    return currentValue;
  }
}

function sortVersions(a: string, b: string): number {
  return npm.sortVersions(poetry2semver(a), poetry2semver(b));
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
