import { isNonEmptyString, isNullOrUndefined } from '@sindresorhus/is';
import { mergeChildConfig } from '../../../../config/index.ts';
import type { MinimumReleaseAgeBehaviour } from '../../../../config/types.ts';
import { logger } from '../../../../logger/index.ts';
import type { Release } from '../../../../modules/datasource/index.ts';
import { postprocessRelease } from '../../../../modules/datasource/postprocess-release.ts';
import type { VersioningApi } from '../../../../modules/versioning/index.ts';
import { getElapsedMs } from '../../../../util/date.ts';
import {
  getMergeConfidenceLevel,
  isActiveConfidenceLevel,
  satisfiesConfidenceLevel,
} from '../../../../util/merge-confidence/index.ts';
import { coerceNumber } from '../../../../util/number.ts';
import { applyPackageRules } from '../../../../util/package-rules/index.ts';
import { toMs } from '../../../../util/pretty-time.ts';
import type { LookupUpdateConfig, UpdateResult } from './types.ts';
import { getUpdateType } from './update-type.ts';

export interface InternalChecksResult {
  release?: Release;
  pendingChecks: boolean;
  pendingReleases: Release[];
}

export async function filterInternalChecks(
  config: Partial<LookupUpdateConfig & UpdateResult>,
  versioningApi: VersioningApi,
  bucket: string,
  sortedReleases: Release[],
): Promise<InternalChecksResult> {
  const {
    currentVersion,
    datasource,
    depName,
    packageName,
    internalChecksFilter,
  } = config;
  let release: Release | undefined = undefined;
  let pendingChecks = false;
  let pendingReleases: Release[] = [];
  if (internalChecksFilter === 'none') {
    // Don't care if minimumReleaseAge or minimumConfidence are unmet
    release = sortedReleases.pop();
  } else {
    const candidateVersionsWithoutReleaseTimestamp: Record<
      MinimumReleaseAgeBehaviour,
      string[]
    > = {
      'timestamp-required': [],
      'timestamp-optional': [],
    };

    // iterate through releases from highest to lowest, looking for the first which will pass checks if present
    for (let candidateRelease of sortedReleases.reverse()) {
      // merge the release data into dependency config
      let releaseConfig = mergeChildConfig(config, candidateRelease);
      // calculate updateType and then apply it
      releaseConfig.updateType = getUpdateType(
        releaseConfig,
        versioningApi,
        // TODO #22198
        currentVersion!,
        candidateRelease.version,
      );
      releaseConfig = mergeChildConfig(
        releaseConfig,
        releaseConfig[releaseConfig.updateType]!,
      );
      // Apply packageRules in case any apply to updateType
      releaseConfig = await applyPackageRules(releaseConfig, 'update-type');

      const updatedCandidateRelease = await postprocessRelease(
        releaseConfig,
        candidateRelease,
      );
      if (!updatedCandidateRelease) {
        continue;
      }
      candidateRelease = updatedCandidateRelease;

      // Now check for a minimumReleaseAge config
      const { minimumConfidence, minimumReleaseAge, updateType } =
        releaseConfig;

      const minimumReleaseAgeMs = isNonEmptyString(minimumReleaseAge)
        ? coerceNumber(toMs(minimumReleaseAge), 0)
        : 0;

      if (minimumReleaseAgeMs) {
        const minimumReleaseAgeBehaviour =
          releaseConfig.minimumReleaseAgeBehaviour;

        // if there is a releaseTimestamp, regardless of `minimumReleaseAgeBehaviour`, we should process it
        if (candidateRelease.releaseTimestamp) {
          // we should skip this if we have a timestamp that isn't passing checks:
          if (
            getElapsedMs(candidateRelease.releaseTimestamp) <
            minimumReleaseAgeMs
          ) {
            // Skip it if it doesn't pass checks
            logger.trace(
              { depName, check: 'minimumReleaseAge' },
              `Release ${candidateRelease.version} is pending status checks`,
            );
            pendingReleases.unshift(candidateRelease);
            continue;
          }
        } // or if there is no timestamp, and we're running in `minimumReleaseAgeBehaviour=timestamp-required`
        else if (
          isNullOrUndefined(candidateRelease.releaseTimestamp) &&
          minimumReleaseAgeBehaviour === 'timestamp-required'
        ) {
          // Skip it, as we require a timestamp
          candidateVersionsWithoutReleaseTimestamp[
            minimumReleaseAgeBehaviour
          ].push(candidateRelease.version);
          pendingReleases.unshift(candidateRelease);
          continue;
        } // if there is no timestamp, and we're running in `optional` mode, we can allow it
        else if (
          isNullOrUndefined(candidateRelease.releaseTimestamp) &&
          minimumReleaseAgeBehaviour === 'timestamp-optional'
        ) {
          candidateVersionsWithoutReleaseTimestamp[
            minimumReleaseAgeBehaviour
          ].push(candidateRelease.version);
        }
      }

      // TODO #22198
      if (isActiveConfidenceLevel(minimumConfidence!)) {
        const confidenceLevel =
          (await getMergeConfidenceLevel(
            datasource!,
            packageName!,
            currentVersion!,
            candidateRelease.version,
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

    if (candidateVersionsWithoutReleaseTimestamp['timestamp-required'].length) {
      logger.once.debug(
        {
          depName,
          versions:
            candidateVersionsWithoutReleaseTimestamp['timestamp-required'],
          check: 'minimumReleaseAge',
        },
        `Marking ${candidateVersionsWithoutReleaseTimestamp['timestamp-required'].length} release(s) as pending, as they do not have a releaseTimestamp and we're running with minimumReleaseAgeBehaviour=timestamp-required`,
      );
    }

    if (candidateVersionsWithoutReleaseTimestamp['timestamp-optional'].length) {
      logger.once.warn(
        "Some release(s) did not have a releaseTimestamp, but as we're running with minimumReleaseAgeBehaviour=timestamp-optional, proceeding. See debug logs for more information",
      );
      logger.once.debug(
        {
          depName,
          versions:
            candidateVersionsWithoutReleaseTimestamp['timestamp-optional'],
          check: 'minimumReleaseAge',
        },
        `${candidateVersionsWithoutReleaseTimestamp['timestamp-optional'].length} release(s) did not have a releaseTimestamp, but as we're running with minimumReleaseAgeBehaviour=timestamp-optional, proceeding`,
      );
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

  return { release, pendingChecks, pendingReleases };
}
