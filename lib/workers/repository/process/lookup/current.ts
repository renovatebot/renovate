import { logger } from '../../../../logger';
import * as allVersioning from '../../../../versioning';
import { LookupUpdateConfig } from './common';

export function getCurrentVersion(
  config: LookupUpdateConfig,
  rangeStrategy: string,
  latestVersion: string,
  allVersions: string[]
): string | null {
  const { currentValue, lockedVersion, versioning } = config;
  const version = allVersioning.get(versioning);
  if (version.isVersion(currentValue)) {
    return currentValue;
  }
  if (version.isSingleVersion(currentValue)) {
    return currentValue.replace(/=/g, '').trim();
  }
  logger.trace(`currentValue ${currentValue} is range`);
  let useVersions = allVersions.filter((v) => version.matches(v, currentValue));
  if (latestVersion && version.matches(latestVersion, currentValue)) {
    useVersions = useVersions.filter(
      (v) => !version.isGreaterThan(v, latestVersion)
    );
  }
  if (rangeStrategy === 'pin') {
    return (
      lockedVersion || version.getSatisfyingVersion(useVersions, currentValue)
    );
  }
  if (rangeStrategy === 'bump') {
    // Use the lowest version in the current range
    return version.minSatisfyingVersion(useVersions, currentValue);
  }
  // Use the highest version in the current range
  return version.getSatisfyingVersion(useVersions, currentValue);
}
