import type { Release } from '../../../../datasource/types';
import { logger } from '../../../../logger';
import type { LookupUpdate } from '../../../../manager/types';
import * as allVersioning from '../../../../versioning';
import type { RollbackConfig } from './types';

export function getRollbackUpdate(
  config: RollbackConfig,
  versions: Release[]
): LookupUpdate {
  const { packageFile, versioning, depName, currentValue } = config;
  const version = allVersioning.get(versioning);
  // istanbul ignore if
  if (!('isLessThanRange' in version)) {
    logger.debug(
      { versioning },
      'Current versioning does not support isLessThanRange()'
    );
    return null;
  }
  const lessThanVersions = versions.filter((v) =>
    version.isLessThanRange(v.version, currentValue)
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
  const newVersion = lessThanVersions.pop()?.version;
  // istanbul ignore if
  if (!newVersion) {
    logger.debug('No newVersion to roll back to');
    return null;
  }
  const newValue = version.getNewValue({
    currentValue,
    rangeStrategy: 'replace',
    newVersion,
  });
  return {
    bucket: 'rollback',
    newMajor: version.getMajor(newVersion),
    newValue,
    newVersion,
    updateType: 'rollback',
  };
}
