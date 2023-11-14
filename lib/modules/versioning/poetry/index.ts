import { parseRange } from 'semver-utils';
import { logger } from '../../../logger';
import type { RangeStrategy } from '../../../types/versioning';
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
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'widen',
  'pin',
  'replace',
];

function equals(a: string, b: string): boolean {
  const semverA = poetry2semver(a);
  const semverB = poetry2semver(b);
  return !!(semverA && semverB && npm.equals(semverA, semverB));
}

function getMajor(version: string): number | null {
  const semverVersion = poetry2semver(version);
  return semverVersion ? npm.getMajor(semverVersion) : null;
}

function getMinor(version: string): number | null {
  const semverVersion = poetry2semver(version);
  return semverVersion ? npm.getMinor(semverVersion) : null;
}

function getPatch(version: string): number | null {
  const semverVersion = poetry2semver(version);
  return semverVersion ? npm.getPatch(semverVersion) : null;
}

function isVersion(input: string): boolean {
  return VERSION_PATTERN.test(input);
}

function isGreaterThan(a: string, b: string): boolean {
  const semverA = poetry2semver(a);
  const semverB = poetry2semver(b);
  return !!(semverA && semverB && npm.isGreaterThan(semverA, semverB));
}

function isLessThanRange(version: string, range: string): boolean {
  const semverVersion = poetry2semver(version);
  return !!(
    isVersion(version) &&
    semverVersion &&
    npm.isLessThanRange?.(semverVersion, poetry2npm(range))
  );
}

export function isValid(input: string): boolean {
  return npm.isValid(poetry2npm(input));
}

function isStable(version: string): boolean {
  const semverVersion = poetry2semver(version);
  return !!(semverVersion && npm.isStable(semverVersion));
}

function matches(version: string, range: string): boolean {
  const semverVersion = poetry2semver(version);
  return !!(
    isVersion(version) &&
    semverVersion &&
    npm.matches(semverVersion, poetry2npm(range))
  );
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const semverVersions: string[] = [];
  versions.forEach((version) => {
    const semverVersion = poetry2semver(version);
    if (semverVersion) {
      semverVersions.push(semverVersion);
    }
  });
  const npmRange = poetry2npm(range);
  const satisfyingVersion = npm.getSatisfyingVersion(semverVersions, npmRange);
  return satisfyingVersion ? semver2poetry(satisfyingVersion) : null;
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const semverVersions: string[] = [];
  versions.forEach((version) => {
    const semverVersion = poetry2semver(version);
    if (semverVersion) {
      semverVersions.push(semverVersion);
    }
  });
  const npmRange = poetry2npm(range);
  const satisfyingVersion = npm.minSatisfyingVersion(semverVersions, npmRange);
  return satisfyingVersion ? semver2poetry(satisfyingVersion) : null;
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
  newVersion: string,
): string | null {
  const toVersionMajor = getMajor(newVersion);
  const toVersionMinor = getMinor(newVersion);
  const split = currentValue.split('.');
  if (toVersionMajor !== null && split.length === 1) {
    // [^,~]4
    return `${operator}${toVersionMajor}`;
  }
  if (
    toVersionMajor !== null &&
    toVersionMinor !== null &&
    split.length === 2
  ) {
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
  if (rangeStrategy === 'pin') {
    return newVersion;
  }
  if (rangeStrategy === 'replace') {
    const npmCurrentValue = poetry2npm(currentValue);
    try {
      const massagedNewVersion = poetry2semver(newVersion);
      if (
        massagedNewVersion &&
        isVersion(massagedNewVersion) &&
        npm.matches(massagedNewVersion, npmCurrentValue)
      ) {
        return currentValue;
      }
    } catch (err) /* istanbul ignore next */ {
      logger.info(
        { err },
        'Poetry versioning: Error caught checking if newVersion satisfies currentValue',
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
    (VERSION_PATTERN.exec(newVersion)?.groups?.release ?? '').split('.')
      .length !== 3
  ) {
    logger.debug(
      'Cannot massage python version to npm - returning currentValue',
    );
    return currentValue;
  }
  try {
    const currentSemverVersion =
      currentVersion && poetry2semver(currentVersion);

    const newSemverVersion = poetry2semver(newVersion);

    if (currentSemverVersion && newSemverVersion) {
      const newSemver = npm.getNewValue({
        currentValue: poetry2npm(currentValue),
        rangeStrategy,
        currentVersion: currentSemverVersion,
        newVersion: newSemverVersion,
      });
      const newPoetry = newSemver && npm2poetry(newSemver);
      if (newPoetry) {
        return newPoetry;
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug(
      { currentValue, rangeStrategy, currentVersion, newVersion, err },
      'Could not generate new value using npm.getNewValue()',
    );
  }

  // istanbul ignore next
  return currentValue;
}

function sortVersions(a: string, b: string): number {
  // istanbul ignore next
  return npm.sortVersions(poetry2semver(a) ?? '', poetry2semver(b) ?? '');
}

function subset(subRange: string, superRange: string): boolean | undefined {
  return npm.subset!(poetry2npm(subRange), poetry2npm(superRange));
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
  subset,
};
export default api;
