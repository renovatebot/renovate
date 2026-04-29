import { mergeChildConfig } from '../../../../config/index.ts';
import type { MinimumReleaseAgeBehaviour } from '../../../../config/types.ts';
import { logger } from '../../../../logger/index.ts';
import type { Release } from '../../../../modules/datasource/index.ts';
import { postprocessRelease } from '../../../../modules/datasource/postprocess-release.ts';
import type { VersioningApi } from '../../../../modules/versioning/index.ts';
import {
  getMergeConfidenceLevel,
  isActiveConfidenceLevel,
  satisfiesConfidenceLevel,
} from '../../../../util/merge-confidence/index.ts';
import { checkMinimumReleaseAge } from '../../../../util/minimum-release-age.ts';
import { applyPackageRules } from '../../../../util/package-rules/index.ts';
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

      const { minimumConfidence, updateType } = releaseConfig;

      const minimumReleaseAgeStatus = checkMinimumReleaseAge(
        candidateRelease,
        releaseConfig,
      );

      if (minimumReleaseAgeStatus === 'pending-elapsed') {
        logger.trace(
          { depName, check: 'minimumReleaseAge' },
          `Release ${candidateRelease.version} is pending status checks`,
        );
        pendingReleases.unshift(candidateRelease);
        continue;
      }

      if (minimumReleaseAgeStatus === 'pending-no-timestamp') {
        candidateVersionsWithoutReleaseTimestamp['timestamp-required'].push(
          candidateRelease.version,
        );
        pendingReleases.unshift(candidateRelease);
        continue;
      }

      if (minimumReleaseAgeStatus === 'allowed-no-timestamp') {
        candidateVersionsWithoutReleaseTimestamp['timestamp-optional'].push(
          candidateRelease.version,
        );
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
      // v8 ignore else -- TODO: add test #40625
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
