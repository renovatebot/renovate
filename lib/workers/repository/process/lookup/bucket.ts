import type { VersioningApi } from '../../../../versioning/types';

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
  versioning: VersioningApi
): string {
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
  const fromMinor = versioning.getMinor(currentVersion);
  const toMinor = versioning.getMinor(newVersion);
  // istanbul ignore if
  if (toMajor === null) {
    return null;
  }
  if (fromMajor !== toMajor) {
    if (separateMultipleMajor) {
      if (separateMultipleMinor) {
        return `major-${toMajor}-minor-${toMinor}`;
      }
      return `major-${toMajor}`;
    }
    if (separateMultipleMinor) {
      return `major-minor-${toMinor}`;
    }
    return 'major';
  }
  if (fromMinor !== toMinor) {
    if (separateMultipleMinor) {
      return `minor-${toMinor}`;
    }
    if (separateMinorPatch) {
      return 'minor';
    }
    return 'non-major';
  }
  if (separateMinorPatch) {
    return 'patch';
  }
  if (separateMultipleMinor) {
    return 'patch';
  }
  return 'non-major';
}
