import { DateTime } from 'luxon';
import type { ReleaseResult } from '../../../../modules/datasource/types';
import type { VersioningApi } from '../../../../modules/versioning/types';
import { type Timestamp, asTimestamp } from '../../../../util/timestamp';

export function calculateLatestReleaseBump(
  versioningApi: VersioningApi,
  releaseResult: ReleaseResult,
): ReleaseResult {
  let highestVersion: string | undefined;
  let highestVersionTimestamp: Timestamp | null = null;
  for (const release of releaseResult.releases) {
    if (!highestVersion) {
      highestVersion = release.version;
      highestVersionTimestamp = asTimestamp(release.releaseTimestamp);
      continue;
    }

    try {
      if (versioningApi.isGreaterThan(release.version, highestVersion)) {
        highestVersion = release.version;
        highestVersionTimestamp = asTimestamp(release.releaseTimestamp);
        continue;
      }
      // eslint-disable-next-line no-empty
    } catch /* v8 ignore next */ {}
  }

  if (highestVersionTimestamp) {
    const highestVersionDateTime = DateTime.fromISO(highestVersionTimestamp);
    const higherTimestampExists = releaseResult.releases.some((release) => {
      const releaseTimestamp = asTimestamp(release.releaseTimestamp);
      if (!releaseTimestamp) {
        return false;
      }

      return DateTime.fromISO(releaseTimestamp) > highestVersionDateTime;
    });

    if (!higherTimestampExists) {
      releaseResult.bumpedAt = highestVersionTimestamp;
    }
  }

  return releaseResult;
}
