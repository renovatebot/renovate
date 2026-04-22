import { isUndefined } from '@sindresorhus/is';
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

const floatingMinorTagRegex = regEx(/^\d+(\.\d+)?$/);
const majorOnlyRegex = regEx(/^\d+$/);

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
  if (!floatingMinorTagRegex.test(stripped)) {
    return null;
  }
  const coerced = semver.coerce(stripped);
  /* v8 ignore next -- unreachable: floatingMinorTagRegex should guarantee coerce() succeeds */
  if (!coerced) {
    return null;
  }
  const { major, minor } = coerced;

  if (majorOnlyRegex.test(stripped)) {
    return { major };
  }

  return { major, minor };
}

/*
 * Like parseVersion but also accepts floating tags (e.g. `v1`, `v1.2`)
 * by coercing them to full semver.
 */
function parseVersionCoerced(input: string): SemVer | null {
  const v = parseVersion(input);
  if (v) {
    return v;
  }
  const stripped = massageValue(input);
  if (!regEx(/^\d/).test(stripped)) {
    return null;
  }
  return semver.coerce(stripped);
}

function isValid(input: string): boolean {
  return !!parseVersion(input) || !!parseRange(input);
}

function isVersion(input: string | undefined | null): boolean {
  if (!input) {
    return false;
  }

  if (parseVersion(input)) {
    return true;
  }

  const stripped = massageValue(input);
  if (!regEx(/^\d/).test(stripped)) {
    return false;
  }

  return parseRange(input) !== null;
}

function isStable(version: string): boolean {
  const v = parseVersionCoerced(version);
  if (!v) {
    return false;
  }

  return v.prerelease.length === 0;
}

function isSingleVersion(input: string): boolean {
  return !!parseVersion(input);
}

function getMajor(version: string): number | null {
  return parseVersionCoerced(version)?.major ?? null;
}

function getMinor(version: string): number | null {
  return parseVersionCoerced(version)?.minor ?? null;
}

function getPatch(version: string): number | null {
  return parseVersionCoerced(version)?.patch ?? null;
}

function sortVersions(x: string, y: string): number {
  const a = parseVersionCoerced(x);
  const b = parseVersionCoerced(y);
  if (!a || !b) {
    return 0;
  }
  return semver.compare(a, b);
}

function equals(x: string, y: string): boolean {
  const a = parseVersionCoerced(x);
  const b = parseVersionCoerced(y);
  if (!a || !b) {
    return false;
  }
  return semver.eq(a, b);
}

function isGreaterThan(x: string, y: string): boolean {
  const a = parseVersionCoerced(x);
  const b = parseVersionCoerced(y);
  if (!a || !b) {
    return false;
  }
  return semver.gt(a, b);
}

function matches(version: string, range: string): boolean {
  // if we have a valid floating tag provided, and it's the same as the range, treat it as the same
  if (
    parseVersionCoerced(version) &&
    massageValue(version) === massageValue(range)
  ) {
    return true;
  }

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
  const v = parseVersionCoerced(version);
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

  // When a minor (i.e. `v1.2`), don't return a less-specific tag (i.e. `v1`), even if it's found in `allVersions`
  const minLevel = isUndefined(range.minor) ? 'major' : 'minor';
  const [prefix] = currentValue.split(massageValue(currentValue));
  const newParsed = parseVersion(newVersion);
  if (!newParsed) {
    const newCoerced = parseVersionCoerced(newVersion);
    if (newCoerced) {
      // check that we're not returning a version that doesn't exist
      // for instance, in the case `v5.5` is tagged, but there's no `v5` (or if it's been deleted)
      const shortest = getShortestMatchingVersion(
        prefix,
        newCoerced,
        allVersions ?? new Set(),
        minLevel,
      );
      if (shortest) {
        return shortest;
      }
    }
    return newVersion;
  }

  // Check if currentValue is a full version (has patch component)
  const currentParsed = parseVersion(currentValue);
  if (currentParsed) {
    // currentValue is a full version, return full newVersion
    return newVersion;
  }

  if (isUndefined(allVersions) || allVersions.size === 0) {
    if (isUndefined(range.minor)) {
      return `${prefix}${newParsed.major}`;
    }

    return `${prefix}${newParsed.major}.${newParsed.minor}`;
  }

  // If a major (i.e. `v7`), and the proposed update is a minor i.e. (`v7.6`), return the existing major version instead of updating to the new minor, as the major should have been re-tagged, too
  if (isUndefined(range.minor) && newParsed.major === range.major) {
    return `${prefix}${newParsed.major}`;
  }

  const shortest = getShortestMatchingVersion(
    prefix,
    newParsed,
    allVersions,
    minLevel,
  );
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
  allVersions: Set<string>,
  minLevel: 'major' | 'minor' = 'major',
): string | null {
  const { major, minor, patch } = newParsed;
  const versions = new Set(allVersions);

  // in shortest-first order: major, minor, patch, full
  if (minLevel === 'major') {
    const v = `${prefix}${major}`;
    if (versions.has(v)) {
      return v;
    }
  }

  const v = `${prefix}${major}.${minor}`;
  if (versions.has(v)) {
    return v;
  }

  const patchVersion = `${prefix}${major}.${minor}.${patch}`;
  if (versions.has(patchVersion)) {
    return patchVersion;
  }

  const fullVersion = `${prefix}${newParsed.toString()}`;
  if (versions.has(fullVersion)) {
    return fullVersion;
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
