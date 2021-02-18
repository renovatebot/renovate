import * as allVersioning from '../../../../versioning';
import { LookupUpdateConfig } from './common';

export function getBucket(
  config: LookupUpdateConfig,
  currentVersion: string,
  newVersion: string,
  versioning: allVersioning.VersioningApi
): string {
  const {
    separateMajorMinor,
    separateMultipleMajor,
    separateMinorPatch,
  } = config;
  if (!separateMajorMinor) {
    return 'latest';
  }
  const fromMajor = versioning.getMajor(currentVersion);
  const toMajor = versioning.getMajor(newVersion);
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
