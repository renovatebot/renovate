import { isUndefined } from '@sindresorhus/is';
import type { SemVer } from 'semver';
import semver from 'semver';
import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import {
  createPartialSemverOps,
  massageValue,
  parsePartialRange,
} from '../semver-partial/common.ts';
import type { PartialSemverRange } from '../semver-partial/types.ts';
import type { NewValueConfig, VersioningApi } from '../types.ts';

export const id = 'github-actions';
export const displayName = 'GitHub Actions';
export const urls = [
  '[GitHub Actions - Using release management for custom actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/find-and-customize-actions#using-release-management-for-your-custom-actions)',
];
export const supportsRanges = true;
export const supportedRangeStrategies = ['pin', 'replace'];

const floatingMinorTagRegex = regEx(/^\d+(?:\.\d+)?$/);

function parseVersion(input: string): SemVer | null {
  const stripped = massageValue(input);
  const v = semver.parse(stripped);
  if (v) {
    return v;
  }
  // Handle major.minor-prerelease format (e.g. v2.2-rc.1) by normalizing to major.minor.0-prerelease
  return semver.parse(
    stripped.replace(
      regEx(/^(?<majorMinor>\d+\.\d+)(?<prerelease>-.+)$/),
      '$<majorMinor>.0$<prerelease>',
    ),
  );
}

function parseRange(input: string): PartialSemverRange | null {
  if (!floatingMinorTagRegex.test(massageValue(input))) {
    return null;
  }
  return parsePartialRange(input);
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

// if we have a valid floating tag provided, and it's the same as the range, treat it as the same
function matchesFloatingTag(version: string, range: string): boolean {
  return (
    !!parseVersionCoerced(version) &&
    massageValue(version) === massageValue(range)
  );
}

// `v1.2` and `1.2` compare as equal, so fall back to the raw values
function compareEqual(x: string, y: string): number {
  return x.localeCompare(y, undefined, { numeric: true });
}

const ops = createPartialSemverOps({
  parseVersion,
  parseVersionForCompare: parseVersionCoerced,
  parseRange,
  matchesAlias: matchesFloatingTag,
  compareEqual,
});

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
  // v8 ignore if -- currentValue can't fail both parseRange and parseVersion
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

export const api: VersioningApi = {
  ...ops,
  isCompatible,
  isValid,
  isVersion,
  getNewValue,
};

export default api;
