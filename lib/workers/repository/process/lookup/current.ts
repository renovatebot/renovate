import { logger } from '../../../../logger';
import * as allVersioning from '../../../../versioning';
import type { LookupUpdateConfig } from './types';

export function getCurrentVersion(
  config: LookupUpdateConfig,
  versioning: allVersioning.VersioningApi,
  rangeStrategy: string,
  latestVersion: string,
  allVersions: string[]
): string | null {
  const { currentValue, lockedVersion } = config;
  if (versioning.isVersion(currentValue)) {
    return currentValue;
  }
  if (versioning.isSingleVersion(currentValue)) {
    return currentValue.replace(/=/g, '').trim();
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
