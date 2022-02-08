import type { Release } from '../../../../datasource';
import { logger } from '../../../../logger';
import type { LookupUpdate } from '../../../../manager/types';
import type { RangeStrategy } from '../../../../types';
import type { VersioningApi } from '../../../../versioning';
import type { LookupUpdateConfig } from './types';
import { getUpdateType } from './update-type';

export function generateUpdate(
  config: LookupUpdateConfig,
  versioning: VersioningApi,
  rangeStrategy: RangeStrategy,
  currentVersion: string,
  bucket: string,
  release: Release
): LookupUpdate {
  const newVersion = release.version;
  const update: LookupUpdate = {
    bucket,
    newVersion,
    newValue: null,
  };
  const releaseFields = [
    'checksumUrl',
    'downloadUrl',
    'newDigest',
    'releaseTimestamp',
  ];
  for (const field of releaseFields) {
    if (release[field] !== undefined) {
      update[field] = release[field];
    }
  }
  const { currentValue } = config;
  if (currentValue) {
    try {
      update.newValue = versioning.getNewValue({
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
      });
    } catch (err) /* istanbul ignore next */ {
      logger.warn(
        { err, currentValue, rangeStrategy, currentVersion, newVersion },
        'getNewValue error'
      );
      update.newValue = currentValue;
    }
  } else {
    update.newValue = currentValue;
  }
  update.newMajor = versioning.getMajor(newVersion);
  update.newMinor = versioning.getMinor(newVersion);
  // istanbul ignore if
  if (!update.updateType && !currentVersion) {
    logger.debug({ update }, 'Update has no currentVersion');
    update.newValue = currentValue;
    return update;
  }
  update.updateType =
    update.updateType ||
    getUpdateType(config, versioning, currentVersion, newVersion);
  if (!versioning.isVersion(update.newValue)) {
    update.isRange = true;
  }
  if (rangeStrategy === 'update-lockfile' && currentValue === update.newValue) {
    update.isLockfileUpdate = true;
  }
  if (
    rangeStrategy === 'bump' &&
    versioning.matches(newVersion, currentValue)
  ) {
    update.isBump = true;
  }
  return update;
}
