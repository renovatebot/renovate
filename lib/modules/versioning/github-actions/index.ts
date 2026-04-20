import { isEmptyArray, isUndefined } from '@sindresorhus/is';
import type { SemVer } from 'semver';
import semver from 'semver';
import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import type { NewValueConfig, VersioningApi } from '../types.ts';

export const id = 'github-actions';
export const displayName = 'GitHub Actions';
export const urls = [
  'https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/find-and-customize-actions#using-release-management-for-your-custom-actions',
];
export const supportsRanges = true;
export const supportedRangeStrategies = ['pin', 'replace'];

function massageValue(input: string): string {
  return input.trim().replace(regEx(/^v/i), '');
}

function parseVersion(input: string): SemVer | null {
  return semver.parse(massageValue(input));
}

interface Range {
  major: number;
  minor?: number;
}

function parseRange(input: string): Range | null {
  const stripped = massageValue(input);
  const coerced = semver.coerce(stripped);
  if (!coerced) {
    return null;
  }
  const { major, minor } = coerced;

  if (regEx(/^\d+$/).test(stripped)) {
    return { major };
  }

  return { major, minor };
}

function isValid(input: string): boolean {
  return !!parseVersion(input) || !!parseRange(input);
}

function isVersion(input: string | undefined | null): boolean {
  if (!input) {
    return false;
  }

  return !!parseVersion(input);
}

function isStable(version: string): boolean {
  const v = parseVersion(version);
  if (!v) {
    return false;
  }

  return v.prerelease.length === 0;
}

function isSingleVersion(input: string): boolean {
  return isVersion(input);
}

function getMajor(version: string): number | null {
  return parseVersion(version)?.major ?? null;
}

function getMinor(version: string): number | null {
  return parseVersion(version)?.minor ?? null;
}

function getPatch(version: string): number | null {
  return parseVersion(version)?.patch ?? null;
}

function sortVersions(x: string, y: string): number {
  const a = parseVersion(x);
  const b = parseVersion(y);
  if (!a || !b) {
    return 0;
  }
  return semver.compare(a, b);
}

function equals(x: string, y: string): boolean {
  const a = parseVersion(x);
  const b = parseVersion(y);
  if (!a || !b) {
    return false;
  }
  return semver.eq(a, b);
}

function isGreaterThan(x: string, y: string): boolean {
  const a = parseVersion(x);
  const b = parseVersion(y);
  if (!a || !b) {
    return false;
  }
  return semver.gt(a, b);
}

function matches(version: string, range: string): boolean {
  const v = parseVersion(version);
  if (!v) {
    return false;
  }

  const rv = parseVersion(range);
  if (rv) {
    return semver.eq(v, rv);
  }

  const r = parseRange(range);
  if (!r) {
    return false;
  }

  if (v.prerelease.length > 0) {
    return false;
  }

  if (v.major !== r.major) {
    return false;
  }

  if (isUndefined(r.minor)) {
    return true;
  }

  return v.minor === r.minor;
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const sortedVersions = versions.sort(sortVersions).reverse();
  for (const version of sortedVersions) {
    if (matches(version, range)) {
      return version;
    }
  }
  return null;
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const sortedVersions = versions.sort(sortVersions);
  for (const version of sortedVersions) {
    if (matches(version, range)) {
      return version;
    }
  }
  return null;
}

function isLessThanRange(version: string, range: string): boolean {
  const v = parseVersion(version);
  const r = parseRange(range);

  if (!v || !r) {
    return false;
  }

  if (v.major !== r.major) {
    return v.major < r.major;
  }

  if (isUndefined(r.minor)) {
    return false;
  }

  if (v.minor !== r.minor) {
    return v.minor < r.minor;
  }

  return false;
}

function getNewValue({
  currentValue,
  currentVersion,
  rangeStrategy,
  newVersion,
  allVersions,
}: NewValueConfig): string | null {
  if (rangeStrategy === 'pin') {
    return newVersion;
  }

  const range = parseRange(currentValue);
  if (!range) {
    return newVersion;
  }

  const newParsed = parseVersion(newVersion);
  if (!newParsed) {
    return newVersion;
  }

  // Check if currentValue is a full version (has patch component)
  const currentParsed = parseVersion(currentValue);
  if (currentParsed) {
    // currentValue is a full version, return full newVersion
    return newVersion;
  }

  const [prefix] = currentValue.split(massageValue(currentValue));

  if (isUndefined(allVersions) || isEmptyArray(allVersions)) {
    if (isUndefined(range.minor)) {
      return `${prefix}${newParsed.major}`;
    }

    return `${prefix}${newParsed.major}.${newParsed.minor}`;
  }

  const shortest = getShortestMatchingVersion(prefix, newParsed, allVersions);
  if (shortest) {
    return shortest;
  }

  logger.once.debug(
    {
      versioning: id,
      currentValue,
      currentVersion,
      newVersion,
      rangeStrategy,
      allVersions,
    },
    `Suggested newValue \`${newVersion}\` was not included in allVersions, but it should have been. Returning it anyway`,
  );

  return newVersion;
}

function getShortestMatchingVersion(
  prefix: string,
  newParsed: SemVer,
  allVersions: string[],
): string | null {
  // in shortest-first order
  const options = [
    `${prefix}${newParsed.major}`,
    `${prefix}${newParsed.major}.${newParsed.minor}`,
    `${prefix}${newParsed.major}.${newParsed.minor}.${newParsed.patch}`,
    `${prefix}${newParsed.toString()}`,
  ];

  for (const option of options) {
    if (allVersions.includes(option)) {
      return option;
    }
  }

  return null;
}

function isCompatible(version: string): boolean {
  return isValid(version);
}

function isBreaking(version: string, current: string): boolean {
  const versionParsed = parseVersion(version);
  const currentParsed = parseVersion(current);

  if (!versionParsed || !currentParsed) {
    return false;
  }

  if (currentParsed.major === 0) {
    return versionParsed.major > 0 || versionParsed.minor > currentParsed.minor;
  }

  return versionParsed.major > currentParsed.major;
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isBreaking,
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
};

export default api;
