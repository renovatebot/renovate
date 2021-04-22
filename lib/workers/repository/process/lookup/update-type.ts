import type { UpdateType } from '../../../../config/types';
import * as allVersioning from '../../../../versioning';

export interface UpdateTypeConfig {
  separateMajorMinor?: boolean;
  separateMultipleMajor?: boolean;
  separateMinorPatch?: boolean;
}

export function getUpdateType(
  config: UpdateTypeConfig,
  versioning: allVersioning.VersioningApi,
  currentVersion: string,
  newVersion: string
): UpdateType {
  if (versioning.getMajor(newVersion) > versioning.getMajor(currentVersion)) {
    return 'major';
  }
  if (versioning.getMinor(newVersion) > versioning.getMinor(currentVersion)) {
    return 'minor';
  }
  return 'patch';
}
