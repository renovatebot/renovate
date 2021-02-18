import { UpdateType } from '../../../../config';
import * as allVersioning from '../../../../versioning';
import { LookupUpdateConfig } from './common';

export function getUpdateType(
  config: LookupUpdateConfig,
  currentVersion: string,
  newVersion: string
): UpdateType {
  const { versioning } = config;
  const version = allVersioning.get(versioning);
  if (version.getMajor(newVersion) > version.getMajor(currentVersion)) {
    return 'major';
  }
  if (version.getMinor(newVersion) > version.getMinor(currentVersion)) {
    return 'minor';
  }
  if (config.separateMinorPatch) {
    return 'patch';
  }
  if (config.patch.automerge && !config.minor.automerge) {
    return 'patch';
  }
  return 'minor';
}
