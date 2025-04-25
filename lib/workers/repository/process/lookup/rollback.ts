import { logger } from '../../../../logger';
import type { Release } from '../../../../modules/datasource/types';
import type { LookupUpdate } from '../../../../modules/manager/types';
import type { VersioningApi } from '../../../../modules/versioning';
import type { RollbackConfig } from './types';

export function getRollbackUpdate(
  config: RollbackConfig,
  versions: Release[],
  versioningApi: VersioningApi,
): LookupUpdate | null {
  const { packageFile, versioning, depName, currentValue } = config;
  // istanbul ignore if
  if (!('isLessThanRange' in versioningApi)) {
    logger.debug(
      { versioning },
      'Current versioning does not support isLessThanRange()',
    );
    return null;
  }
  const lessThanVersions = versions.filter((v) => {
    try {
      return versioningApi.isLessThanRange!(v.version, currentValue!);
    } catch /* istanbul ignore next */ {
      return false;
    }
  });
  // istanbul ignore if
  if (!lessThanVersions.length) {
    logger.debug(
      { packageFile, depName, currentValue },
      'Missing version has nothing to roll back to',
    );
    return null;
  }
  logger.debug(
    { packageFile, depName, currentValue },
    `Current version not found - rolling back`,
  );
  logger.debug(
    { dependency: depName, versions },
    'Versions found before rolling back',
  );

  lessThanVersions.sort((a, b) =>
    versioningApi.sortVersions(a.version, b.version),
  );
  let newRelease;
  if (currentValue && versioningApi.isStable(currentValue)) {
    newRelease = lessThanVersions
      .filter((v) => versioningApi.isStable(v.version))
      .pop();
  }
  let newVersion = newRelease?.version;
  let registryUrl = newRelease?.registryUrl;

  if (!newVersion) {
    newRelease = lessThanVersions.pop();
    newVersion = newRelease?.version;
    registryUrl = newRelease?.registryUrl;
  }
  // istanbul ignore if
  if (!newVersion) {
    logger.debug('No newVersion to roll back to');
    return null;
  }
  const newValue = versioningApi.getNewValue({
    // TODO #22198
    currentValue: currentValue!,
    rangeStrategy: 'replace',
    newVersion,
  });
  return {
    bucket: 'rollback',
    // TODO #22198
    newMajor: versioningApi.getMajor(newVersion)!,
    newValue: newValue!,
    newVersion,
    registryUrl,
    updateType: 'rollback',
  };
}
