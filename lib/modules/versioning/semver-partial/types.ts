import type { SemVer } from 'semver';
import type { VersioningApi } from '../types.ts';

/**
 * A partial semver range: a major version, optionally narrowed down by a minor version.
 */
export interface PartialSemverRange {
  major: number;
  minor?: number;
}

export interface PartialSemverConfig {
  /**
   * Parses a full version such as `v1.2.3`.
   */
  parseVersion: (input: string) => SemVer | null;

  /**
   * Parses a version for comparison and digestion.
   *
   * Defaults to `parseVersion`. Modules which treat floating tags as versions pass a coercing parser here.
   */
  parseVersionForCompare?: (input: string) => SemVer | null;

  /**
   * Parses a partial range such as `v1` or `v1.2`.
   */
  parseRange: (input: string) => PartialSemverRange | null;

  /**
   * Matches ranges which are not partial semver ranges, such as `~latest`.
   *
   * It is consulted before the partial range logic.
   */
  matchesAlias?: (version: string, range: string) => boolean;

  /**
   * Tie-breaks two values whose versions compare as equal, such as `v1.2` and `1.2`.
   */
  compareEqual?: (x: string, y: string) => number;
}

export type PartialSemverOps = Required<
  Pick<
    VersioningApi,
    | 'equals'
    | 'getMajor'
    | 'getMinor'
    | 'getPatch'
    | 'getSatisfyingVersion'
    | 'isBreaking'
    | 'isGreaterThan'
    | 'isLessThanRange'
    | 'isSingleVersion'
    | 'isStable'
    | 'matches'
    | 'minSatisfyingVersion'
    | 'sortVersions'
  >
>;
