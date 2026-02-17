import semver from 'semver';
import stable from 'semver-stable';
import type { RangeStrategy } from '../../../types/versioning.ts';
import { regEx } from '../../../util/regex.ts';
import type { NewValueConfig, VersioningApi } from '../types.ts';

export const id = 'elm';
export const displayName = 'Elm';
export const urls = ['https://elm-lang.org'];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'widen',
  'replace',
];

const { is: isStable } = stable;

const {
  compare: sortVersions,
  major: getMajor,
  minor: getMinor,
  patch: getPatch,
  valid,
  gt: isGreaterThan,
  gte: isGreaterThanOrEqual,
  eq: equals,
} = semver;

/**
 * Elm range format: "1.0.0 <= v < 2.0.0"
 * - Lower bound is inclusive (<=)
 * - Upper bound is exclusive (<)
 */
const elmRangeRegex = regEx(
  /^(?<lower>\d+\.\d+\.\d+)\s*<=\s*v\s*<\s*(?<upper>\d+\.\d+\.\d+)$/,
);

/**
 * Parse Elm range constraint into lower and upper bounds
 * Returns null if the range is invalid or malformed (e.g., lower > upper)
 */
function parseElmRange(input: string): { lower: string; upper: string } | null {
  const groups = elmRangeRegex.exec(input.trim())?.groups;
  if (!groups) {
    return null;
  }
  const { lower, upper } = groups;
  if (isGreaterThan(lower, upper)) {
    return null;
  }
  return { lower, upper };
}

/**
 * Check if input is a valid semver version
 */
export function isVersion(input: string | undefined | null): boolean {
  if (!input) {
    return false;
  }
  return !!valid(input);
}

/**
 * Check if input is a valid Elm version or range
 */
export function isValid(input: string): boolean {
  if (isVersion(input)) {
    return true;
  }
  const range = parseElmRange(input);
  if (!range) {
    return false;
  }
  return isVersion(range.lower) && isVersion(range.upper);
}

/**
 * Check if version matches the range constraint
 */
function matches(version: string, range: string): boolean {
  if (!isVersion(version)) {
    return false;
  }
  if (isVersion(range)) {
    return equals(version, range);
  }
  const parsed = parseElmRange(range);
  if (!parsed) {
    return false;
  }
  const { lower, upper } = parsed;
  // version >= lower && version < upper
  return isGreaterThanOrEqual(version, lower) && isGreaterThan(upper, version);
}

/**
 * Check if version is less than the range's lower bound
 */
function isLessThanRange(version: string, range: string): boolean {
  if (!isVersion(version)) {
    return false;
  }
  if (isVersion(range)) {
    return isGreaterThan(range, version);
  }
  const parsed = parseElmRange(range);
  if (!parsed) {
    return false;
  }
  return isGreaterThan(parsed.lower, version);
}

/**
 * Select the highest version from versions that matches the range
 */
function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const validVersions = versions
    .filter((v) => isVersion(v) && matches(v, range))
    .sort((a, b) => sortVersions(b, a));
  return validVersions[0] ?? null;
}

/**
 * Select the lowest version from versions that matches the range
 */
function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const validVersions = versions
    .filter((v) => isVersion(v) && matches(v, range))
    .sort((a, b) => sortVersions(a, b));
  return validVersions[0] ?? null;
}

/**
 * Check if input represents exactly one version (no range)
 */
function isSingleVersion(input: string): boolean {
  return isVersion(input);
}

/**
 * Check if version is stable (not prerelease)
 */
function isStableVersion(version: string): boolean {
  if (!isVersion(version)) {
    return false;
  }
  return isStable(version);
}

/**
 * Check if version is compatible
 */
function isCompatible(version: string): boolean {
  return isVersion(version);
}

/**
 * Calculate the next major version (e.g., "1.2.3" -> "2.0.0")
 */
function nextMajor(version: string): string {
  return `${getMajor(version) + 1}.0.0`;
}

/**
 * Calculate a new range/version based on the range strategy
 */
function getNewValue({
  currentValue,
  rangeStrategy,
  newVersion,
}: NewValueConfig): string | null {
  if (!isVersion(newVersion)) {
    return null;
  }

  // If current value is an exact version, return new exact version
  if (isVersion(currentValue)) {
    return newVersion;
  }

  const parsed = parseElmRange(currentValue);
  if (!parsed) {
    return null;
  }

  const { lower, upper } = parsed;

  switch (rangeStrategy) {
    case 'pin':
      return newVersion;

    case 'bump': {
      // Bump the lower bound to the new version, keep upper if it still contains newVersion
      // Otherwise bump upper to next major of newVersion
      if (matches(newVersion, currentValue)) {
        return `${newVersion} <= v < ${upper}`;
      }
      return `${newVersion} <= v < ${nextMajor(newVersion)}`;
    }

    case 'widen': {
      // Widen the range to include the new version
      if (matches(newVersion, currentValue)) {
        return currentValue;
      }
      // Extend upper bound if newVersion is greater than or equal to upper
      const newUpper = isGreaterThanOrEqual(newVersion, upper)
        ? nextMajor(newVersion)
        : upper;
      return `${lower} <= v < ${newUpper}`;
    }

    case 'replace': {
      // Replace with a new range starting at newVersion
      return `${newVersion} <= v < ${nextMajor(newVersion)}`;
    }

    case 'update-lockfile': {
      // Keep the range as-is if it still matches
      if (matches(newVersion, currentValue)) {
        return currentValue;
      }
      // Otherwise use replace strategy
      return `${newVersion} <= v < ${nextMajor(newVersion)}`;
    }

    default:
      return null;
  }
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
  isSingleVersion,
  isStable: isStableVersion,
  isValid,
  isVersion,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  sortVersions,
};

export default api;
