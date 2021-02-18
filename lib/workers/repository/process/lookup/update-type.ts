import { UpdateType } from '../../../../config';
import * as allVersioning from '../../../../versioning';
import { LookupUpdateConfig } from './common';

export function getUpdateType(
  config: LookupUpdateConfig,
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
  if (config.separateMinorPatch) {
    return 'patch';
  }
  return 'minor';
}
