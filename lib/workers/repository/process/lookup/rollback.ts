import { logger } from '../../../../logger';
import * as allVersioning from '../../../../versioning';
import { LookupUpdate } from '../../../../manager/common';

export interface RollbackConfig {
  currentValue?: string;
  depName?: string;
  packageFile: string;
  versioning: string;
}

export function getRollbackUpdate(
  config: RollbackConfig,
  versions: string[]
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
    version.isLessThanRange(v, currentValue)
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
  lessThanVersions.sort((a, b) => version.sortVersions(a, b));
  const toVersion = lessThanVersions.pop();
  // istanbul ignore if
  if (!toVersion) {
    logger.debug('No toVersion to roll back to');
    return null;
  }
  const newValue = version.getNewValue({
    currentValue,
    rangeStrategy: 'replace',
    toVersion,
  });
  return {
    updateType: 'rollback',
    branchName:
      '{{{branchPrefix}}}rollback-{{{depNameSanitized}}}-{{{newMajor}}}.x',
    commitMessageAction: 'Roll back',
    isRollback: true,
    newValue,
    newMajor: version.getMajor(toVersion),
    semanticCommitType: 'fix',
  };
}
