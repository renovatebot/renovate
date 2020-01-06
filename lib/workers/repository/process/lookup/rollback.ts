import { logger } from '../../../../logger';
import * as versioning from '../../../../versioning';
import { LookupUpdate } from './common';

export interface RollbackConfig {
  currentValue?: string;
  depName?: string;
  packageFile: string;
  versionScheme: string;
}

export function getRollbackUpdate(
  config: RollbackConfig,
  versions: string[]
): LookupUpdate {
  const { packageFile, versionScheme, depName, currentValue } = config;
  const version = versioning.get(versionScheme);
  // istanbul ignore if
  if (!version.isLessThanRange) {
    logger.info(
      { versionScheme },
      'Current version scheme does not support isLessThanRange()'
    );
    return null;
  }
  const lessThanVersions = versions.filter(v =>
    version.isLessThanRange(v, currentValue)
  );
  // istanbul ignore if
  if (!lessThanVersions.length) {
    logger.info(
      { packageFile, depName, currentValue },
      'Missing version has nothing to roll back to'
    );
    return null;
  }
  logger.info(
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
    logger.info('No toVersion to roll back to');
    return null;
  }
  let fromVersion: string;
  const newValue = version.getNewValue(
    currentValue,
    'replace',
    fromVersion,
    toVersion
  );
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
