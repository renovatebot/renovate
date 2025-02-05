import is from '@sindresorhus/is';
import { logger } from '../../../../logger';
import type { VersioningApi } from '../../../../modules/versioning/types';
import { regEx } from '../../../../util/regex';

export function getCurrentVersion(
  currentValue: string,
  lockedVersion: string,
  versioningApi: VersioningApi,
  rangeStrategy: string,
  latestVersion: string,
  allVersions: string[],
): string | null {
  // istanbul ignore if
  if (!is.string(currentValue)) {
    return null;
  }
  logger.trace(`currentValue ${currentValue} is range`);
  if (allVersions.includes(currentValue)) {
    return currentValue;
  }
  let useVersions = allVersions.filter((v) =>
    versioningApi.matches(v, currentValue),
  );
  if (useVersions.length === 1) {
    return useVersions[0];
  }
  if (latestVersion && versioningApi.matches(latestVersion, currentValue)) {
    useVersions = useVersions.filter(
      (v) => !versioningApi.isGreaterThan(v, latestVersion),
    );
  }
  if (rangeStrategy === 'pin') {
    return (
      lockedVersion ||
      versioningApi.getSatisfyingVersion(useVersions, currentValue)
    );
  }
  if (rangeStrategy === 'bump') {
    // Use the lowest version in the current range
    return versioningApi.minSatisfyingVersion(useVersions, currentValue);
  }
  // Use the highest version in the current range
  const satisfyingVersion = versioningApi.getSatisfyingVersion(
    useVersions,
    currentValue,
  );
  if (satisfyingVersion) {
    return satisfyingVersion;
  }

  if (versioningApi.isVersion(currentValue)) {
    return currentValue;
  }
  if (versioningApi.isSingleVersion(currentValue)) {
    return currentValue.replace(regEx(/=/g), '').trim();
  }

  return null;
}
