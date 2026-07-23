import { isNonEmptyString } from '@sindresorhus/is';
import { mergeChildConfig } from '../../../../config/index.ts';
import type {
  MinimumReleaseAgeBehaviour,
  UpdateType,
} from '../../../../config/types.ts';
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
import type { MergeConfidence } from '../../../../util/merge-confidence/types.ts';
import { coerceNumber } from '../../../../util/number.ts';
import { applyPackageRules } from '../../../../util/package-rules/index.ts';
import { toMs } from '../../../../util/pretty-time.ts';
import type { Timestamp } from '../../../../util/timestamp.ts';
import type { LookupUpdateConfig, UpdateResult } from './types.ts';
import { getUpdateType } from './update-type.ts';

export interface InternalChecksResult {
  release?: Release;
  pendingChecks: boolean;
  pendingReleases: Release[];
}

export interface MinimumReleaseAgeCheckResult {
  isPending: boolean;
  minimumReleaseAgeMs: number;
  hasTimestamp: boolean;
}

/**
 * Checks whether a release is old enough to satisfy `minimumReleaseAge`.
 *
 * This is deliberately independent of `filterInternalChecks()`'s
 * bucket-of-candidate-versions machinery (`getUpdateType`, package rules,
 * confidence lookups) so it can also be used for updates which were never
 * built from a set of candidate versions in the first place - e.g. a
 * digest-only refresh, where the "new" value is the same as `currentValue`.
 */
export function checkMinimumReleaseAge(
  config: {
    minimumReleaseAge?: string | null;
    minimumReleaseAgeBehaviour?: MinimumReleaseAgeBehaviour | null;
  },
  releaseTimestamp: Timestamp | null | undefined,
): MinimumReleaseAgeCheckResult {
  const minimumReleaseAgeMs = isNonEmptyString(config.minimumReleaseAge)
    ? coerceNumber(toMs(config.minimumReleaseAge), 0)
    : 0;

  if (!minimumReleaseAgeMs) {
    return {
      isPending: false,
      minimumReleaseAgeMs,
      hasTimestamp: !!releaseTimestamp,
    };
  }

  if (releaseTimestamp) {
    return {
      isPending: getElapsedMs(releaseTimestamp) < minimumReleaseAgeMs,
      minimumReleaseAgeMs,
      hasTimestamp: true,
    };
  }

  return {
    isPending: config.minimumReleaseAgeBehaviour === 'timestamp-required',
    minimumReleaseAgeMs,
    hasTimestamp: false,
  };
}

export interface MinimumConfidenceCheckResult {
  isPending: boolean;
}

/**
 * Checks whether a release satisfies `minimumConfidence`. Separated out for
 * the same reason as `checkMinimumReleaseAge()` above.
 */
export async function checkMinimumConfidence(
  config: {
    minimumConfidence?: MergeConfidence;
    datasource?: string;
    packageName?: string;
  },
  currentVersion: string,
  candidateVersion: string,
  updateType: UpdateType,
): Promise<MinimumConfidenceCheckResult> {
  const { minimumConfidence, datasource, packageName } = config;
  if (!isActiveConfidenceLevel(minimumConfidence!)) {
    return { isPending: false };
  }

  const confidenceLevel =
    (await getMergeConfidenceLevel(
      datasource!,
      packageName!,
      currentVersion,
      candidateVersion,
      updateType,
    )) ?? 'neutral';
  return {
    isPending: !satisfiesConfidenceLevel(confidenceLevel, minimumConfidence!),
  };
}

export async function filterInternalChecks(
  config: Partial<LookupUpdateConfig & UpdateResult>,
  versioningApi: VersioningApi,
  bucket: string,
  sortedReleases: Release[],
): Promise<InternalChecksResult> {
  const { currentVersion, depName, internalChecksFilter } = config;
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
      const { updateType } = releaseConfig;

      const ageCheck = checkMinimumReleaseAge(
        releaseConfig,
        candidateRelease.releaseTimestamp,
      );
      if (ageCheck.minimumReleaseAgeMs) {
        if (!ageCheck.hasTimestamp) {
          const minimumReleaseAgeBehaviour =
            releaseConfig.minimumReleaseAgeBehaviour;
          // v8 ignore else -- TODO: add test #40625
          if (
            minimumReleaseAgeBehaviour === 'timestamp-required' ||
            minimumReleaseAgeBehaviour === 'timestamp-optional'
          ) {
            candidateVersionsWithoutReleaseTimestamp[
              minimumReleaseAgeBehaviour
            ].push(candidateRelease.version);
          }
        }

        if (ageCheck.isPending) {
          // v8 ignore else -- TODO: add test #40625
          if (ageCheck.hasTimestamp) {
            // Skip it if it doesn't pass checks
            logger.trace(
              { depName, check: 'minimumReleaseAge' },
              `Release ${candidateRelease.version} is pending status checks`,
            );
          } // or if there is no timestamp, and we're running in `minimumReleaseAgeBehaviour=timestamp-required`, skip it as we require a timestamp
          pendingReleases.unshift(candidateRelease);
          continue;
        }
      }

      const confidenceCheck = await checkMinimumConfidence(
        releaseConfig,
        currentVersion!,
        candidateRelease.version,
        updateType!,
      );
      if (confidenceCheck.isPending) {
        logger.trace(
          { depName, check: 'minimumConfidence' },
          `Release ${candidateRelease.version} is pending status checks`,
        );
        pendingReleases.unshift(candidateRelease);
        continue;
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

    // v8 ignore else -- TODO: add test #40625
    if (!release && pendingReleases.length) {
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

  return { release, pendingChecks, pendingReleases };
}
