import { logger } from '../../../../logger';
import type { Release } from '../../../../modules/datasource/types';
import type { LookupUpdate } from '../../../../modules/manager/types';
import type { VersioningApi } from '../../../../modules/versioning';
import type { RollbackConfig } from './types';

export function getRollbackUpdate(
  config: RollbackConfig,
  versions: Release[],
  version: VersioningApi
): LookupUpdate | null {
  const { packageFile, versioning, depName, currentValue } = config;
  // istanbul ignore if
  if (!('isLessThanRange' in version)) {
    logger.debug(
      { versioning },
      'Current versioning does not support isLessThanRange()'
    );
    return null;
  }
  const lessThanVersions = versions.filter((v) =>
    // TODO #7154
    version.isLessThanRange!(v.version, currentValue!)
  );
  // istanbul ignore if
  if (!lessThanVersions.length) {
    logger.debug(
      { packageFile, depName, currentValue },
      'Missing version has nothing to roll back to'
    );
    return null;
  }
  logger.debug(
    { packageFile, depName, currentValue },
    `Current version not found - rolling back`
  );
  logger.debug(
    { dependency: depName, versions },
    'Versions found before rolling back'
  );

  lessThanVersions.sort((a, b) => version.sortVersions(a.version, b.version));
  let newVersion;
  if (currentValue && version.isStable(currentValue)) {
    newVersion = lessThanVersions
      .filter((v) => version.isStable(v.version))
      .pop()?.version;
  }
  if (!newVersion) {
    newVersion = lessThanVersions.pop()?.version;
  }
  // istanbul ignore if
  if (!newVersion) {
    logger.debug('No newVersion to roll back to');
    return null;
  }
  const newValue = version.getNewValue({
    // TODO #7154
    currentValue: currentValue!,
    rangeStrategy: 'replace',
    newVersion,
  });
  return {
    bucket: 'rollback',
    // TODO #7154
    newMajor: version.getMajor(newVersion)!,
    newValue: newValue!,
    newVersion,
    updateType: 'rollback',
  };
}
