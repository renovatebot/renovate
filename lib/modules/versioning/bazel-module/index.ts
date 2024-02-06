import type { NewValueConfig, VersioningApi } from '../types';
import { BzlmodVersion } from './bzlmod-version';

export const id = 'bazel-module';
export const displayName = 'Bazel Module';
export const urls = ['https://bazel.build/external/module'];
export const supportsRanges = false;

function getBzlmodVersion(version: string): BzlmodVersion {
  return new BzlmodVersion(version);
}

function getMajor(version: string): null | number {
  return getBzlmodVersion(version).release.major;
}

function getMinor(version: string): null | number {
  return getBzlmodVersion(version).release.minor;
}

function getPatch(version: string): null | number {
  return getBzlmodVersion(version).release.patch;
}

/**
 * Check whether `version` and `other` are logically equivalent, even if
 * they're not the exact same string.
 *
 * For example, with Semver the build metadata should be ignored when comparing.
 */
function equals(version: string, other: string): boolean {
  const abv = new BzlmodVersion(version);
  const bbv = new BzlmodVersion(other);
  return abv.equals(bbv);
}

/**
 * Check whether `version` is "greater" than the `other` version.
 */
function isGreaterThan(version: string, other: string): boolean {
  const abv = new BzlmodVersion(version);
  const bbv = new BzlmodVersion(other);
  return abv.isGreaterThan(bbv);
}

/**
 * Check whether the `version` is "less" than all the versions possible in
 * the `range`.
 */
function isLessThanRange(version: string, range: string): boolean {
  const abv = new BzlmodVersion(version);
  const bbv = new BzlmodVersion(range);
  return abv.isLessThan(bbv);
}

/**
 * Select the highest version from `versions` that is within the given
 * `range` constraint, or return `null` if there is no matching version.
 */
function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const target = new BzlmodVersion(range);
  const result = versions.find((ver) => {
    const bv = new BzlmodVersion(ver);
    return target.equals(bv);
  });
  return result ? range : null;
}

/**
 * Select the lowest version from `versions` that is within the given
 * `range` constraint, or return `null` if there is no matching version.
 */
function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return getSatisfyingVersion(versions, range);
}

/**
 * Calculate a new version constraint based on the current constraint, the
 * `rangeStrategy` option, and the current and new version.
 */
function getNewValue({ newVersion }: NewValueConfig): string {
  return newVersion;
}

/**
 * Compare two versions. Return `0` if `v1 == v2`, or `1` if `v1` is
 * greater, or `-1` if `v2` is greater.
 */
function sortVersions(version: string, other: string): number {
  const abv = new BzlmodVersion(version);
  const bbv = new BzlmodVersion(other);
  return BzlmodVersion.defaultCompare(abv, bbv);
}

/**
 * Check whether the `version` satisfies the `range` constraint.
 */
function matches(version: string, range: string): boolean {
  return equals(version, range);
}

/**
 * Check whether the `version` is compatible with the `current` value
 * constraint.
 */
function isCompatible(version: string, current?: string): boolean {
  return isValid(version);
}

/**
 * Check whether the `version` constraint is not a range, i.e. it only allows a
 * single specific version.
 */
function isSingleVersion(version: string): boolean {
  return isValid(version);
}

/**
 * Check whether the `version` is considered to be "stable".
 *
 * Example: in SemVer the version must not have a pre-release marker.
 */
function isStable(version: string): boolean {
  const abv = new BzlmodVersion(version);
  return !abv.isPrerelease;
}

/**
 * Check whether the `input` is a valid version or a valid version range constraint.
 */
function isValid(input: string): boolean {
  try {
    new BzlmodVersion(input);
  } catch (e) {
    return false;
  }
  return true;
}

/**
 * Check whether the `input` is a valid version string.
 */
function isVersion(input: string | undefined | null): boolean {
  if (input === undefined || input === null) {
    return false;
  }
  return isValid(input);
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
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
