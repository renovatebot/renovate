import type { SemVer } from 'semver';
import type { RangeStrategy } from '../../types';

export interface NewValueConfig {
  currentValue: string;
  rangeStrategy: RangeStrategy;
  currentVersion?: string;
  newVersion: string;
  isReplacement?: boolean;
}
export interface VersioningApi {
  // validation

  /**
   * Check whether the `input` is the valid version or range.
   *
   * For some managers, ranges are called "constraints","specifiers", "requirements", etc.
   * We stick to the term "range" for all of it.
   */
  isValid(input: string): boolean;

  /**
   * Check whether the `input` is a valid version.
   *
   * There is no direct way to determine whether the `input` is the range,
   * but combination of `isVersion` and `isValid` can be used for that:
   *
   *    `isValid(input) && !isVersion(input)`
   */
  isVersion(input: string | undefined | null): boolean;

  /**
   * Check whether the `input` is the:
   *
   *   1. Version, or
   *   2. Range with the special syntax of matching exactly one version:
   *      - `==1.2.3` or `===1.2.3` for Python,
   *      - `=1.2.3` for NPM,
   *      - `[1.2.3]` for Maven or NuGet.
   *
   * This is used to provide pinning functionality.
   */
  isSingleVersion(input: string): boolean;

  /**
   * Check whether the `version` is considered to be "stable".
   */
  isStable(version: string): boolean;

  /**
   * Determines whether the version is compatible with the current one,
   * in some manager-dependent way.
   *
   * For most managers, all valid versions are compatible between each other.
   *
   * However, for example, Docker versions `1.2.3` and `1.2.4-alpine` are not compatible,
   * i.e. `1.2.4-alpine` is not a valid upgrade for `1.2.3`.
   */
  isCompatible(version: string, current?: string): boolean;

  isBreaking?(current: string, version: string): boolean;

  // digestion of version

  getMajor(version: string | SemVer): null | number;
  getMinor(version: string | SemVer): null | number;
  getPatch(version: string | SemVer): null | number;

  // comparison

  /**
   * Check whether `version` and `other` are logically equivalent, even if
   * they're not the exact same string.
   *
   * For example, with Semver the build metadata should be ignored when comparing.
   */
  equals(version: string, other: string): boolean;

  /**
   * Check whether `version` is "greater" than the `other` version.
   */
  isGreaterThan(version: string, other: string): boolean;

  /**
   * Check whether the `version` is "less" than all the versions possible in
   * the `range`.
   */
  isLessThanRange?(version: string, range: string): boolean;

  /**
   * Select the highest version from `versions` that is within the given
   * `range` constraint, or return `null` if there is no matching version.
   */
  getSatisfyingVersion(versions: string[], range: string): string | null;

  /**
   * Select the lowest version from `versions` that is within the given
   * `range` constraint, or return `null` if there is no matching version.
   */
  minSatisfyingVersion(versions: string[], range: string): string | null;

  /**
   * Calculate a new version constraint based on the current constraint, the
   * `rangeStrategy` option, and the current and new version.
   */
  getNewValue(newValueConfig: NewValueConfig): string | null;

  /**
   * Compare two versions. Return `0` if `v1 == v2`, or `1` if `v1` is
   * greater, or `-1` if `v2` is greater.
   */
  sortVersions(version: string, other: string): number;

  /**
   * Check whether the `version` satisfies the `range` constraint.
   */
  matches(version: string, range: string): boolean;

  valueToVersion?(version: string): string;

  /**
   * @returns true if subRange is entirely contained by superRange, false otherwise,
   * and undefined if it cannot determine it.
   *
   * @param subRange - the sub range
   * @param superRange - the dom range
   */
  subset?(subRange: string, superRange: string): boolean | undefined;

  /**
   * Checks whether subRange intersects superRange.
   */
  intersects?(subRange: string, superRange: string): boolean;

  /**
   * Return whether unstable-to-unstable upgrades within the same major version are allowed.
   */
  allowUnstableMajorUpgrades?: boolean;

  /**
   * Check whether the `type` in the `a` and `b` version numbers match.
   * Both `a` and `b` must pass `isVersion`.
   */
  isSame?(type: 'major' | 'minor' | 'patch', a: string, b: string): boolean;
}

export type VersioningApiConstructor = new (config?: string) => VersioningApi;
