import { assignKeys } from '../../../util/assign-keys.ts';
import type { Http, SafeJsonError } from '../../../util/http/index.ts';
import type { AsyncResult } from '../../../util/result.ts';
import { joinUrlParts as join } from '../../../util/url.ts';
import type { ReleaseResult } from '../types.ts';
import { GemMetadata, GemVersions } from './schema.ts';

export function assignMetadata(
  releases: ReleaseResult,
  metadata: GemMetadata,
): ReleaseResult {
  return assignKeys(releases, metadata, [
    'changelogUrl',
    'sourceUrl',
    'homepage',
  ]);
}

export function getV1Metadata(
  http: Http,
  registryUrl: string,
  packageName: string,
): AsyncResult<GemMetadata, SafeJsonError> {
  const metadataUrl = join(registryUrl, '/api/v1/gems', `${packageName}.json`);
  return http.getJsonSafe(metadataUrl, GemMetadata);
}

export function getV1Releases(
  http: Http,
  registryUrl: string,
  packageName: string,
): AsyncResult<ReleaseResult, SafeJsonError | 'unsupported-api'> {
  const versionsUrl = join(
    registryUrl,
    '/api/v1/versions',
    `${packageName}.json`,
  );

  return http.getJsonSafe(versionsUrl, GemVersions).transform((releaseResult) =>
    getV1Metadata(http, registryUrl, packageName)
      .transform((metadata) => assignMetadata(releaseResult, metadata))
      .unwrapOr(releaseResult),
  );
}
