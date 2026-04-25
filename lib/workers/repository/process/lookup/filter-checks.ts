import {
  isNonEmptyString,
  isNullOrUndefined,
  isPlainObject,
} from '@sindresorhus/is';
import { mergeChildConfig } from '../../../../config/index.ts';
import type {
  MinimumReleaseAgeBehaviour,
  MinimumReleaseAgeConfig,
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
import { coerceNumber } from '../../../../util/number.ts';
import { applyPackageRules } from '../../../../util/package-rules/index.ts';
import { toMs } from '../../../../util/pretty-time.ts';
import type { LookupUpdateConfig, UpdateResult } from './types.ts';
import { getUpdateType } from './update-type.ts';

/** Map from update type to the corresponding delay key in MinimumReleaseAgeConfig */
const updateTypeToDelayKey = new Map<string, keyof MinimumReleaseAgeConfig>([
  ['major', 'delayMajor'],
  ['minor', 'delayMinor'],
]);

export interface InternalChecksResult {
  release?: Release;
  pendingChecks: boolean;
  pendingReleases: Release[];
}

interface ResolvedMinimumReleaseAge {
  /** Minimum age for the individual release (from default/string form) */
  releaseMs: number;
  /** Minimum age for the first release in the version group (from delayMajor/delayMinor keys) */
  groupMs: number;
}

/**
 * Resolves the effective minimum release age configuration.
 * Supports both string form ("3 days") and object form ({ default: "3 days", delayMinor: "6 days" }).
 */
function resolveMinimumReleaseAge(
  minimumReleaseAge: string | MinimumReleaseAgeConfig | null | undefined,
  updateType: string | undefined,
): ResolvedMinimumReleaseAge {
  if (isNonEmptyString(minimumReleaseAge)) {
    return {
      releaseMs: coerceNumber(toMs(minimumReleaseAge), 0),
      groupMs: 0,
    };
  }

  if (isPlainObject(minimumReleaseAge)) {
    const config = minimumReleaseAge as MinimumReleaseAgeConfig;
    const releaseMs = config.default
      ? coerceNumber(toMs(config.default), 0)
      : 0;

    let groupMs = 0;
    if (updateType !== undefined) {
      const delayKey = updateTypeToDelayKey.get(updateType);
      if (delayKey) {
        const typeValue = config[delayKey];
        if (typeValue) {
          groupMs = coerceNumber(toMs(typeValue), 0);
        }
      } else if (updateType === 'patch' && config.delayPatch) {
        // For patch, the type-specific value overrides the default for individual release age
        return {
          releaseMs: coerceNumber(toMs(config.delayPatch), 0),
          groupMs: 0,
        };
      }
    }

    return { releaseMs, groupMs };
  }

  return { releaseMs: 0, groupMs: 0 };
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

    // Build maps of version group -> first release timestamp (before reversing)
    // Used for version-group-based minimumReleaseAge checks (major/minor keys)
    // sortedReleases is in ascending version order at this point, so the first
    // occurrence of each key is the earliest version in that group
    const minorVersionFirstTimestamp = new Map<
      string,
      string | null | undefined
    >();
    const majorVersionFirstTimestamp = new Map<
      number,
      string | null | undefined
    >();
    for (const rel of sortedReleases) {
      const major = versioningApi.getMajor(rel.version);
      const minor = versioningApi.getMinor(rel.version);
      if (major !== null) {
        if (!majorVersionFirstTimestamp.has(major)) {
          majorVersionFirstTimestamp.set(major, rel.releaseTimestamp);
        }
        if (minor !== null) {
          const key = `${major}.${minor}`;
          if (!minorVersionFirstTimestamp.has(key)) {
            minorVersionFirstTimestamp.set(key, rel.releaseTimestamp);
          }
        }
      }
    }

    // Get current version's keys for comparison
    const currentMajor = currentVersion
      ? versioningApi.getMajor(currentVersion)
      : null;
    const currentMinor = currentVersion
      ? versioningApi.getMinor(currentVersion)
      : null;
    const currentMinorKey =
      currentMajor !== null && currentMinor !== null
        ? `${currentMajor}.${currentMinor}`
        : null;

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

      const { releaseMs: minimumReleaseAgeMs, groupMs: minimumGroupAgeMs } =
        resolveMinimumReleaseAge(minimumReleaseAge, updateType);

      if (minimumReleaseAgeMs) {
        const minimumReleaseAgeBehaviour =
          releaseConfig.minimumReleaseAgeBehaviour;

        // if there is a releaseTimestamp, regardless of `minimumReleaseAgeBehaviour`, we should process it
        // v8 ignore else -- TODO: add test #40625
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

      // Check version-group-based minimumReleaseAge (major/minor keys in object form)
      if (minimumGroupAgeMs) {
        const minimumReleaseAgeBehaviour =
          releaseConfig.minimumReleaseAgeBehaviour;
        const candidateMajor = versioningApi.getMajor(candidateRelease.version);

        if (updateType === 'minor') {
          const candidateMinor = versioningApi.getMinor(
            candidateRelease.version,
          );

          if (candidateMajor !== null && candidateMinor !== null) {
            const candidateMinorKey = `${candidateMajor}.${candidateMinor}`;

            // Only apply if the minor version is different from the current version
            if (candidateMinorKey !== currentMinorKey) {
              const firstMinorTimestamp =
                minorVersionFirstTimestamp.get(candidateMinorKey);

              if (firstMinorTimestamp) {
                if (getElapsedMs(firstMinorTimestamp) < minimumGroupAgeMs) {
                  logger.trace(
                    { depName, check: 'minimumReleaseAge' },
                    `Release ${candidateRelease.version} is pending - minor version ${candidateMinorKey} is not old enough`,
                  );
                  pendingReleases.unshift(candidateRelease);
                  continue;
                }
              } else if (minimumReleaseAgeBehaviour === 'timestamp-required') {
                pendingReleases.unshift(candidateRelease);
                continue;
              }
            }
          }
        } else if (updateType === 'major') {
          if (candidateMajor !== null) {
            // Only apply if the major version is different from the current version
            if (candidateMajor !== currentMajor) {
              const firstMajorTimestamp =
                majorVersionFirstTimestamp.get(candidateMajor);

              if (firstMajorTimestamp) {
                if (getElapsedMs(firstMajorTimestamp) < minimumGroupAgeMs) {
                  logger.trace(
                    { depName, check: 'minimumReleaseAge' },
                    `Release ${candidateRelease.version} is pending - major version ${candidateMajor} is not old enough`,
                  );
                  pendingReleases.unshift(candidateRelease);
                  continue;
                }
              } else if (minimumReleaseAgeBehaviour === 'timestamp-required') {
                pendingReleases.unshift(candidateRelease);
                continue;
              }
            }
          }
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
