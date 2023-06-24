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
   * Check whether the `version` is compatible with the `current` value
   * constraint.
   */
  isCompatible(version: string, current?: string): boolean;

  /**
   * Check whether the `version` constraint is not a range, i.e. it only allows a
   * single specific version.
   */
  isSingleVersion(version: string): boolean;

  /**
   * Check whether the `version` is considered to be "stable".
   *
   * Example: in SemVer the version must not have a pre-release marker.
   */
  isStable(version: string): boolean;

  /**
   * Check whether the `input` is a valid version or a valid version range constraint.
   */
  isValid(input: string): boolean;

  /**
   * Check whether the `input` is a valid version string.
   */
  isVersion(input: string | undefined | null): boolean;

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
   * Return whether unstable-to-unstable upgrades within the same major version are allowed.
   */
  allowUnstableMajorUpgrades?: boolean;
}

export interface VersioningApiConstructor {
  new (config?: string): VersioningApi;
}
