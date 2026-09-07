import { isUndefined } from '@sindresorhus/is';
import semver from 'semver';
import { regEx } from '../../../util/regex.ts';
import type {
  PartialSemverConfig,
  PartialSemverOps,
  PartialSemverRange,
} from './types.ts';

const leadingVRegex = regEx(/^v/i);
const majorOnlyRegex = regEx(/^\d+$/);

/**
 * Strips surrounding whitespace and the optional `v` prefix.
 */
export function massageValue(input: string): string {
  return input.trim().replace(leadingVRegex, '');
}

/**
 * Parses a partial semver range such as `1` or `v1.2`.
 *
 * This accepts anything `semver.coerce()` accepts, so modules which only allow floating tags have to reject the other inputs themselves.
 */
export function parsePartialRange(input: string): PartialSemverRange | null {
  const stripped = massageValue(input);
  const coerced = semver.coerce(stripped);
  if (!coerced) {
    return null;
  }
  const { major, minor } = coerced;

  if (majorOnlyRegex.test(stripped)) {
    return { major };
  }

  return { major, minor };
}

/**
 * Builds the versioning operations shared by the partial semver modules, i.e. the modules where a version may be shortened to `major` or `major.minor`.
 */
export function createPartialSemverOps(
  config: PartialSemverConfig,
): PartialSemverOps {
  const {
    parseVersion,
    parseVersionForCompare = parseVersion,
    parseRange,
    matchesAlias,
    compareEqual,
  } = config;

  function isStable(version: string): boolean {
    const v = parseVersionForCompare(version);
    if (!v) {
      return false;
    }

    return v.prerelease.length === 0;
  }

  function isSingleVersion(input: string): boolean {
    return !!parseVersion(input);
  }

  function getMajor(version: string): number | null {
    return parseVersionForCompare(version)?.major ?? null;
  }

  function getMinor(version: string): number | null {
    return parseVersionForCompare(version)?.minor ?? null;
  }

  function getPatch(version: string): number | null {
    return parseVersionForCompare(version)?.patch ?? null;
  }

  function sortVersions(x: string, y: string): number {
    const a = parseVersionForCompare(x);
    const b = parseVersionForCompare(y);
    if (!a || !b) {
      return 0;
    }
    const cmp = semver.compare(a, b);
    if (cmp === 0 && compareEqual) {
      return compareEqual(x, y);
    }
    return cmp;
  }

  function equals(x: string, y: string): boolean {
    const a = parseVersionForCompare(x);
    const b = parseVersionForCompare(y);
    if (!a || !b) {
      return false;
    }
    return semver.eq(a, b);
  }

  function isGreaterThan(x: string, y: string): boolean {
    const a = parseVersionForCompare(x);
    const b = parseVersionForCompare(y);
    if (!a || !b) {
      return false;
    }
    return semver.gt(a, b);
  }

  function matches(version: string, range: string): boolean {
    if (matchesAlias?.(version, range)) {
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
    const v = parseVersionForCompare(version);
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

  function isBreaking(current: string, version: string): boolean {
    const versionParsed = parseVersion(version);
    const currentParsed = parseVersion(current);

    if (!versionParsed || !currentParsed) {
      return false;
    }

    if (currentParsed.major === 0) {
      return (
        versionParsed.major > 0 || versionParsed.minor > currentParsed.minor
      );
    }

    return versionParsed.major > currentParsed.major;
  }

  return {
    equals,
    getMajor,
    getMinor,
    getPatch,
    getSatisfyingVersion,
    isBreaking,
    isGreaterThan,
    isLessThanRange,
    isSingleVersion,
    isStable,
    matches,
    minSatisfyingVersion,
    sortVersions,
  };
}
