import { isString } from '@sindresorhus/is';
import type { Release } from '../../../../modules/datasource/index.ts';
import type { VersioningApi } from '../../../../modules/versioning/types.ts';
import { classifyRelease } from './update-type.ts';

export interface BucketConfig {
  separateMajorMinor?: boolean;
  separateMultipleMajor?: boolean;
  separateMultipleMinor?: boolean;
  separateMinorPatch?: boolean;
}

export function getBucket(
  config: BucketConfig,
  currentVersion: string,
  newVersion: string,
  versioningApi: VersioningApi,
): string | null {
  const {
    separateMajorMinor,
    separateMultipleMajor,
    separateMultipleMinor,
    separateMinorPatch,
  } = config;
  if (!separateMajorMinor) {
    return 'latest';
  }
  const toMajor = versioningApi.getMajor(newVersion);

  // istanbul ignore if: error case
  if (toMajor === null) {
    return null;
  }

  const updateType = classifyRelease(versioningApi, currentVersion, newVersion);

  // Check for major update type first
  if (updateType === 'major') {
    if (separateMultipleMajor) {
      return `v${toMajor}`;
    }
    // default path for major updates is not to separate them
    return 'major';
  }

  // If we reach here then we know it's non-major

  // A versioning which cannot name the minor of either version cannot name a minor bucket either, so fall back to the shared non-major bucket
  const fromMinor = versioningApi.getMinor(currentVersion);
  const toMinor = versioningApi.getMinor(newVersion);

  // istanbul ignore if: error case
  if (fromMinor === null || toMinor === null) {
    return 'non-major';
  }

  // Check the minor update type first
  if (updateType === 'minor') {
    if (separateMultipleMinor) {
      return `v${toMajor}.${toMinor}`;
    }

    if (separateMinorPatch) {
      return 'minor';
    }
    // default path for minor updates is not to separate them from patch
    return 'non-major';
  }

  // If we reach here then we know it's a patch release

  /* future option
  if (separateMultiplePatch) {
    const toPatch = versioningApi.getPatch(newVersion);
    if (toPatch !== null && separateMultiplePatch) {
      return `v${toMajor}.${toMinor}.${toPatch}`;
    }
  }
  */

  if (separateMinorPatch) {
    return 'patch';
  }
  // default path for patch updates is not to separate them from minor
  return 'non-major';
}

/**
 * Group candidate releases by the bucket their update would land in.
 *
 * Releases which have no bucket are dropped.
 */
export function groupReleasesIntoBuckets(
  config: BucketConfig,
  currentVersion: string,
  releases: Release[],
  versioningApi: VersioningApi,
): Record<string, Release[]> {
  const buckets: Record<string, Release[]> = {};
  for (const release of releases) {
    const bucket = getBucket(
      config,
      currentVersion,
      release.version,
      versioningApi,
    );
    // `getBucket()` only returns null when the versioning api cannot
    // determine a major, but every release reaching it has already passed
    // `isVersion()`, so a null major contradicts that and the else looks
    // unreachable rather than merely untested
    // v8 ignore else -- see #40625
    if (isString(bucket)) {
      buckets[bucket] ??= [];
      buckets[bucket].push(release);
    }
  }
  return buckets;
}
