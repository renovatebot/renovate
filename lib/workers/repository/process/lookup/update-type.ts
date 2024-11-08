import type { UpdateType } from '../../../../config/types';
import type * as allVersioning from '../../../../modules/versioning';

export interface UpdateTypeConfig {
  separateMajorMinor?: boolean;
  separateMultipleMajor?: boolean;
  separateMultipleMinor?: boolean;
  separateMinorPatch?: boolean;
}

export function getUpdateType(
  config: UpdateTypeConfig,
  versioningApi: allVersioning.VersioningApi,
  currentVersion: string,
  newVersion: string,
): UpdateType {
  if (
    versioningApi.isSame &&
    !versioningApi.isSame('major', newVersion, currentVersion)
  ) {
    return 'major';
  }
  if (
    versioningApi.getMajor(newVersion)! >
    versioningApi.getMajor(currentVersion)!
  ) {
    return 'major';
  }
  if (
    versioningApi.getMinor(newVersion)! >
    versioningApi.getMinor(currentVersion)!
  ) {
    return 'minor';
  }
  return 'patch';
}
