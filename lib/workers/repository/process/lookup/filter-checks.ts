import is from '@sindresorhus/is';
import { mergeChildConfig } from '../../../../config';
import { logger } from '../../../../logger';
import type { Release } from '../../../../modules/datasource';
import type { VersioningApi } from '../../../../modules/versioning';
import { getElapsedMs } from '../../../../util/date';
import {
  getMergeConfidenceLevel,
  isActiveConfidenceLevel,
  satisfiesConfidenceLevel,
} from '../../../../util/merge-confidence';
import { coerceNumber } from '../../../../util/number';
import { applyPackageRules } from '../../../../util/package-rules';
import { toMs } from '../../../../util/pretty-time';
import type { LookupUpdateConfig, UpdateResult } from './types';
import { getUpdateType } from './update-type';

export interface InternalChecksResult {
  release: Release;
  pendingChecks: boolean;
  pendingReleases?: Release[];
}

export async function filterInternalChecks(
  config: Partial<LookupUpdateConfig & UpdateResult>,
  versioning: VersioningApi,
  bucket: string,
  sortedReleases: Release[],
): Promise<InternalChecksResult> {
  const { currentVersion, datasource, depName, internalChecksFilter } = config;
  let release: Release | undefined = undefined;
  let pendingChecks = false;
  let pendingReleases: Release[] = [];
  if (internalChecksFilter === 'none') {
    // Don't care if minimumReleaseAge or minimumConfidence are unmet
    release = sortedReleases.pop();
  } else {
    // iterate through releases from highest to lowest, looking for the first which will pass checks if present
    for (const candidateRelease of sortedReleases.reverse()) {
      // merge the release data into dependency config
      let releaseConfig = mergeChildConfig(config, candidateRelease);
      // calculate updateType and then apply it
      releaseConfig.updateType = getUpdateType(
        releaseConfig,
        versioning,
        // TODO #22198
        currentVersion!,
        candidateRelease.version,
      );
      releaseConfig = mergeChildConfig(
        releaseConfig,
        releaseConfig[releaseConfig.updateType]!,
      );
      // Apply packageRules in case any apply to updateType
      releaseConfig = applyPackageRules(releaseConfig);
      // Now check for a minimumReleaseAge config
      const {
        minimumConfidence,
        minimumReleaseAge,
        releaseTimestamp,
        version: newVersion,
        updateType,
      } = releaseConfig;
      if (is.nonEmptyString(minimumReleaseAge) && releaseTimestamp) {
        if (
          getElapsedMs(releaseTimestamp) <
          coerceNumber(toMs(minimumReleaseAge), 0)
        ) {
          // Skip it if it doesn't pass checks
          logger.trace(
            { depName, check: 'minimumReleaseAge' },
            `Release ${candidateRelease.version} is pending status checks`,
          );
          pendingReleases.unshift(candidateRelease);
          continue;
        }
      }

      // TODO #22198
      if (isActiveConfidenceLevel(minimumConfidence!)) {
        const confidenceLevel =
          (await getMergeConfidenceLevel(
            datasource!,
            depName!,
            currentVersion!,
            newVersion,
            updateType!,
          )) ?? 'neutral';
        // TODO #22198
        if (!satisfiesConfidenceLevel(confidenceLevel, minimumConfidence!)) {
          logger.trace(
            { depName, check: 'minimumConfidence' },
            `Release ${candidateRelease.version} is pending status checks`,
          );
          pendingReleases.unshift(candidateRelease);
          continue;
        }
      }
      // If we get to here, then the release is OK and we can stop iterating
      release = candidateRelease;
      break;
    }
    if (!release) {
      if (pendingReleases.length) {
        // If all releases were pending then just take the highest
        logger.trace(
          { depName, bucket },
          'All releases are pending - using latest',
        );
        release = pendingReleases.pop();
        // None are pending anymore because we took the latest, so empty the array
        pendingReleases = [];
        if (internalChecksFilter === 'strict') {
          pendingChecks = true;
        }
      }
    }
  }

  // TODO #22198
  return { release: release!, pendingChecks, pendingReleases };
}
