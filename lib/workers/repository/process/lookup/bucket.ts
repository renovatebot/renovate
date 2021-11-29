import type { VersioningApi } from '../../../../versioning/types';

export interface BucketConfig {
  separateMajorMinor?: boolean;
  separateMultipleMajor?: boolean;
  separateMinorPatch?: boolean;
}

export function getBucket(
  config: BucketConfig,
  currentVersion: string,
  newVersion: string,
  versioning: VersioningApi
): string {
  const { separateMajorMinor, separateMultipleMajor, separateMinorPatch } =
    config;
  if (!separateMajorMinor) {
    return 'latest';
  }
  const fromMajor = versioning.getMajor(currentVersion);
  const toMajor = versioning.getMajor(newVersion);
  // istanbul ignore if
  if (toMajor === null) {
    return null;
  }
  if (fromMajor !== toMajor) {
    if (separateMultipleMajor) {
      return `major-${toMajor}`;
    }
    return 'major';
  }
  if (separateMinorPatch) {
    if (
      versioning.getMinor(currentVersion) === versioning.getMinor(newVersion)
    ) {
      return 'patch';
    }
    return 'minor';
  }
  return 'non-major';
}
