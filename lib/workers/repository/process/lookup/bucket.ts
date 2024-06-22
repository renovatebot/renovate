import type { VersioningApi } from '../../../../modules/versioning/types';

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
  versioning: VersioningApi,
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
  const fromMajor = versioning.getMajor(currentVersion);
  const toMajor = versioning.getMajor(newVersion);

  // istanbul ignore if: error case
  if (toMajor === null) {
    return null;
  }

  // Check for major update type first
  if (fromMajor !== toMajor) {
    if (separateMultipleMajor) {
      return `v${toMajor}`;
    }
    // default path for major updates is not to separate them
    return 'major';
  }

  // If we reach here then we know it's non-major

  const fromMinor = versioning.getMinor(currentVersion);
  const toMinor = versioning.getMinor(newVersion);

  // istanbul ignore if: error case
  if (fromMinor === null || toMinor === null) {
    return 'non-major';
  }

  // Check the minor update type first
  if (fromMinor !== toMinor) {
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
    const toPatch = versioning.getPatch(newVersion);
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
