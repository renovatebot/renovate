import * as semver from 'semver';
import type { RangeStrategy } from '../../../types/versioning';
import { api as looseAPI } from '../loose';
import type { NewValueConfig, VersioningApi } from '../types';
import {
  cleanVersion,
  findSatisfyingVersion,
  getOptions,
  makeVersion,
  matchesWithOptions,
} from './common';
import {
  bumpRange,
  getMajor,
  getMinor,
  getPatch,
  replaceRange,
  widenRange,
} from './range';

export const id = 'conan';
export const displayName = 'conan';
export const urls = [
  'https://semver.org/',
  'https://github.com/podhmo/python-node-semver',
  'https://github.com/podhmo/python-node-semver/tree/master/examples',
  'https://docs.conan.io/en/latest/versioning/version_ranges.html#version-ranges',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'auto',
  'bump',
  'widen',
  'replace',
];

const MIN = 1;
const MAX = -1;

function isVersion(input: string): boolean {
  if (input && !input.includes('[')) {
    const qualifiers = getOptions(input);
    const version = cleanVersion(input);
    if (qualifiers.loose) {
      if (looseAPI.isVersion(version)) {
        return true;
      }
    }
    return makeVersion(version, qualifiers) !== null;
  }
  return false;
}

function isValid(input: string): boolean {
  const version = cleanVersion(input);
  const qualifiers = getOptions(input);
  if (makeVersion(version, qualifiers)) {
    return version !== null;
  }

  return semver.validRange(version, qualifiers) !== null;
}

function equals(version: string, other: string): boolean {
  const cleanedVersion = cleanVersion(version);
  const cleanOther = cleanVersion(other);
  const options = { loose: true, includePrerelease: true };
  const looseResult = looseAPI.equals(cleanedVersion, cleanOther);
  try {
    return semver.eq(cleanedVersion, cleanOther, options) || looseResult;
  } catch {
    return looseResult;
  }
}

function isGreaterThan(version: string, other: string): boolean {
  const cleanedVersion = cleanVersion(version);
  const cleanOther = cleanVersion(other);
  const options = { loose: true, includePrerelease: true };
  const looseResult = looseAPI.isGreaterThan(cleanedVersion, cleanOther);
  try {
    return semver.gt(cleanedVersion, cleanOther, options) || looseResult;
  } catch {
    return looseResult;
  }
}

function isLessThanRange(version: string, range: string): boolean {
  const cleanedVersion = cleanVersion(version);
  const cleanRange = cleanVersion(range);
  const options = getOptions(range);
  const looseResult: any = looseAPI.isLessThanRange?.(
    cleanedVersion,
    cleanRange,
  );
  try {
    return semver.ltr(cleanedVersion, cleanRange, options) || looseResult;
  } catch {
    return looseResult;
  }
}

function sortVersions(version: string, other: string): number {
  const cleanedVersion = cleanVersion(version);
  const cleanOther = cleanVersion(other);
  const options = { loose: true, includePrerelease: true };
  try {
    return semver.compare(cleanedVersion, cleanOther, options);
  } catch {
    return looseAPI.sortVersions(cleanedVersion, cleanOther);
  }
}

function matches(version: string, range: string): boolean {
  if (isVersion(version) && isVersion(range)) {
    return true;
  }
  const cleanedVersion = cleanVersion(version);
  const options = getOptions(range);
  const cleanRange = cleanVersion(range);
  return matchesWithOptions(cleanedVersion, cleanRange, options);
}

function isCompatible(version: string, range: string): boolean {
  if (isVersion(version) && isVersion(range)) {
    return true;
  }
  const options = getOptions(range);
  const compatibleVersion = makeVersion(version, options);
  if (compatibleVersion) {
    return !isLessThanRange(version, range);
  }
  return false;
}

function isStable(version: string): boolean {
  const cleanedVersion = cleanVersion(version);
  const options = getOptions(version);
  if (
    !options.includePrerelease &&
    semver.prerelease(cleanedVersion, options)
  ) {
    return false;
  }

  return true;
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return findSatisfyingVersion(versions, range, MIN);
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return findSatisfyingVersion(versions, range, MAX);
}

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string | null {
  const cleanRange = cleanVersion(currentValue);
  if (isVersion(currentValue) || rangeStrategy === 'pin') {
    return newVersion;
  }
  const options = getOptions(currentValue);
  let newValue: any = '';

  if (rangeStrategy === 'widen') {
    newValue = widenRange(
      { currentValue: cleanRange, rangeStrategy, currentVersion, newVersion },
      options,
    );
  } else if (rangeStrategy === 'bump') {
    newValue = bumpRange(
      { currentValue: cleanRange, rangeStrategy, currentVersion, newVersion },
      options,
    );
  } else {
    newValue = replaceRange({
      currentValue: cleanRange,
      rangeStrategy,
      currentVersion,
      newVersion,
    });
  }

  if (newValue) {
    return currentValue.replace(cleanRange, newValue);
  }

  return null;
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getNewValue,
  getPatch,
  isCompatible,
  isGreaterThan,
  isLessThanRange,
  isSingleVersion: isVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  sortVersions,
};

export default api;
