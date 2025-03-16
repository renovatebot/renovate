import { DateTime } from 'luxon';
import type {
  Release,
  ReleaseResult,
} from '../../../../modules/datasource/types';
import type { VersioningApi } from '../../../../modules/versioning/types';
import { asTimestamp } from '../../../../util/timestamp';

export function calculateLatestReleaseBump(
  versioningApi: VersioningApi,
  releaseResult: ReleaseResult,
): ReleaseResult {
  let highestRelease: Release | undefined;
  for (const release of releaseResult.releases) {
    if (!highestRelease) {
      highestRelease = release;
      continue;
    }

    try {
      if (
        versioningApi.isGreaterThan(release.version, highestRelease.version)
      ) {
        highestRelease = release;
        continue;
      }
      // eslint-disable-next-line no-empty
    } catch /* v8 ignore next */ {}
  }

  if (!highestRelease) {
    return releaseResult;
  }

  if (highestRelease.isDeprecated) {
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
      releaseResult.bumpedAt = highestReleaseTimestamp;
    }
  }

  return releaseResult;
}
