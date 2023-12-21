import is from '@sindresorhus/is';
import { logger } from '../../../../logger';
import type { Release } from '../../../../modules/datasource';
import type { LookupUpdate } from '../../../../modules/manager/types';
import type { VersioningApi } from '../../../../modules/versioning';
import type { RangeStrategy } from '../../../../types';
import { getMergeConfidenceLevel } from '../../../../util/merge-confidence';
import type { LookupUpdateConfig } from './types';
import { getUpdateType } from './update-type';

export async function generateUpdate(
  config: LookupUpdateConfig,
  currentValue: string | undefined,
  versioning: VersioningApi,
  rangeStrategy: RangeStrategy,
  currentVersion: string,
  bucket: string,
  release: Release,
): Promise<LookupUpdate> {
  const newVersion = release.version;
  const update: LookupUpdate = {
    bucket,
    newVersion,
    newValue: null!,
  };

  // istanbul ignore if
  if (release.checksumUrl !== undefined) {
    update.checksumUrl = release.checksumUrl;
  }
  // istanbul ignore if
  if (release.downloadUrl !== undefined) {
    update.downloadUrl = release.downloadUrl;
  }
  // istanbul ignore if
  if (release.newDigest !== undefined) {
    update.newDigest = release.newDigest;
  }
  // istanbul ignore if
  if (release.releaseTimestamp !== undefined) {
    update.releaseTimestamp = release.releaseTimestamp;
  }
  // istanbul ignore if
  if (release.registryUrl !== undefined) {
    /**
     * This means:
     *  - registry strategy is set to merge
     *  - releases were fetched from multiple registry urls
     */
    update.registryUrl = release.registryUrl;
  }

  if (currentValue) {
    try {
      update.newValue = versioning.getNewValue({
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
      })!;
    } catch (err) /* istanbul ignore next */ {
      logger.warn(
        { err, currentValue, rangeStrategy, currentVersion, newVersion },
        'getNewValue error',
      );
      update.newValue = currentValue;
    }
  } else {
    update.newValue = currentValue;
  }
  update.newMajor = versioning.getMajor(newVersion)!;
  update.newMinor = versioning.getMinor(newVersion)!;
  // istanbul ignore if
  if (!update.updateType && !currentVersion) {
    logger.debug({ update }, 'Update has no currentVersion');
    update.newValue = currentValue!;
    return update;
  }
  update.updateType =
    update.updateType ??
    getUpdateType(config, versioning, currentVersion, newVersion);
  const { datasource, packageName, packageRules } = config;
  if (packageRules?.some((pr) => is.nonEmptyArray(pr.matchConfidence))) {
    update.mergeConfidenceLevel = await getMergeConfidenceLevel(
      datasource,
      packageName,
      currentVersion,
      newVersion,
      update.updateType,
    );
  }
  if (!versioning.isVersion(update.newValue)) {
    update.isRange = true;
  }
  if (rangeStrategy === 'update-lockfile' && currentValue === update.newValue) {
    update.isLockfileUpdate = true;
  }
  if (
    rangeStrategy === 'bump' &&
    // TODO #22198
    versioning.matches(newVersion, currentValue!)
  ) {
    update.isBump = true;
  }
  return update;
}
