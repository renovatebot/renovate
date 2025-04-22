import { DateTime } from 'luxon';
import { logger } from '../../../../logger';
import type {
  Release,
  ReleaseResult,
} from '../../../../modules/datasource/types';
import type { VersioningApi } from '../../../../modules/versioning/types';
import { asTimestamp } from '../../../../util/timestamp';

/**
 * Calculates the `bumpedAt` value for a set of releases.
 *
 * This function determines the highest release (a release with the highest version)
 * and checks if its timestamp is also the highest among all releases.
 * If so, it assigns that timestamp as the `bumpedAt` value in the result.
 * This helps identify if the package was abandoned.
 *
 * The function skips setting `bumpedAt` if:
 * - No releases could be determined as the highest (e.g. for invalid versions)
 * - The highest release is deprecated
 * - A lower version has a more recent timestamp than the highest version
 *
 * @returns The `ReleaseResult` value, potentially updated with a `bumpedAt` timestamp
 */
export function calculateLatestReleaseBump(
  versioningApi: VersioningApi,
  releaseResult: ReleaseResult,
): ReleaseResult {
  const { lookupName } = releaseResult;

  let highestRelease: Release | undefined;
  for (const release of releaseResult.releases) {
    if (!highestRelease) {
      if (versioningApi.isVersion(release.version)) {
        highestRelease = release;
      }

      continue;
    }

    try {
      if (
        versioningApi.isGreaterThan(release.version, highestRelease.version)
      ) {
        highestRelease = release;
        continue;
      }
    } catch {
      logger.trace({ lookupName }, 'Error calculating "bumpedAt" value');
    }
  }

  if (!highestRelease) {
    logger.trace(
      { lookupName },
      'Could not determine the highest release to calculate "bumpedAt" value',
    );
    return releaseResult;
  }

  if (highestRelease.isDeprecated) {
    logger.trace(
      { lookupName },
      'Highest release is deprecated, skip calculating "bumpedAt" value',
    );
    return releaseResult;
  }

  const highestReleaseTimestamp = asTimestamp(highestRelease.releaseTimestamp);
  if (highestReleaseTimestamp) {
    const highestReleaseDatetime = DateTime.fromISO(highestReleaseTimestamp);
    const higherTimestampExists = releaseResult.releases.some((release) => {
      const releaseTimestamp = asTimestamp(release.releaseTimestamp);
      if (!releaseTimestamp) {
        return false;
      }

      return DateTime.fromISO(releaseTimestamp) > highestReleaseDatetime;
    });

    if (!higherTimestampExists) {
      logger.trace(
        { lookupName },
        'Using "bumpedAt" value because it is the highest timestamp of the highest release version',
      );
      releaseResult.bumpedAt = highestReleaseTimestamp;
      return releaseResult;
    }
  }

  logger.trace(
    { lookupName },
    'Skip using "bumpedAt" value because the higher timestamp exists for lower version',
  );
  return releaseResult;
}
