import type { ReleaseResult } from '../../../../modules/datasource/types';
import type { VersioningApi } from '../../../../modules/versioning/types';
import { type Timestamp, asTimestamp } from '../../../../util/timestamp';

export function calculateLatestReleaseTimestamp(
  versioningApi: VersioningApi,
  releaseResult: ReleaseResult,
): ReleaseResult {
  let latestVersion: string | undefined;
  let latestReleaseTimestamp: Timestamp | null = null;
  for (const release of releaseResult.releases) {
    if (!latestVersion) {
      latestVersion = release.version;
      latestReleaseTimestamp = asTimestamp(release.releaseTimestamp);
      continue;
    }

    if (versioningApi.isGreaterThan(release.version, latestVersion)) {
      latestVersion = release.version;
      latestReleaseTimestamp = asTimestamp(release.releaseTimestamp);
    }
  }

  if (latestReleaseTimestamp) {
    releaseResult.latestReleaseTimestamp = latestReleaseTimestamp;
  }

  return releaseResult;
}
