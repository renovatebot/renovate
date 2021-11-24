import is from '@sindresorhus/is';
import { logger } from '../../../../logger';
import { regEx } from '../../../../util/regex';
import type { VersioningApi } from '../../../../versioning/types';

export function getCurrentVersion(
  currentValue: string,
  lockedVersion: string,
  versioning: VersioningApi,
  rangeStrategy: string,
  latestVersion: string,
  allVersions: string[]
): string | null {
  if (lockedVersion && is.undefined(currentValue)) {
    return allVersions.pop();
  }
  // istanbul ignore if
  if (!is.string(currentValue)) {
    return null;
  }
  if (versioning.isVersion(currentValue)) {
    return currentValue;
  }
  if (versioning.isSingleVersion(currentValue)) {
    return currentValue.replace(regEx(/=/g), '').trim();
  }
  logger.trace(`currentValue ${currentValue} is range`);
  let useVersions = allVersions.filter((v) =>
    versioning.matches(v, currentValue)
  );
  if (latestVersion && versioning.matches(latestVersion, currentValue)) {
    useVersions = useVersions.filter(
      (v) => !versioning.isGreaterThan(v, latestVersion)
    );
  }
  if (rangeStrategy === 'pin') {
    return (
      lockedVersion ||
      versioning.getSatisfyingVersion(useVersions, currentValue)
    );
  }
  if (rangeStrategy === 'bump') {
    // Use the lowest version in the current range
    return versioning.minSatisfyingVersion(useVersions, currentValue);
  }
  // Use the highest version in the current range
  return versioning.getSatisfyingVersion(useVersions, currentValue);
}
