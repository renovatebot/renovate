import { assignKeys } from '../../../util/assign-keys';
import { type Http, HttpError, type SafeJsonError } from '../../../util/http';
import { type AsyncResult, Result } from '../../../util/result';
import { joinUrlParts as join } from '../../../util/url';
import type { ReleaseResult } from '../types';
import { GemMetadata, GemVersions } from './schema';

export function assignMetadata(
  releases: ReleaseResult,
  metadata: GemMetadata
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
  packageName: string
): AsyncResult<GemMetadata, SafeJsonError> {
  const metadataUrl = join(registryUrl, '/api/v1/gems', `${packageName}.json`);
  return http.getJsonSafe(metadataUrl, GemMetadata);
}

export function getV1Releases(
  http: Http,
  registryUrl: string,
  packageName: string
): AsyncResult<ReleaseResult, SafeJsonError | 'unsupported-api'> {
  const versionsUrl = join(
    registryUrl,
    '/api/v1/versions',
    `${packageName}.json`
  );

  return http.getJsonSafe(versionsUrl, GemVersions).catch((err) => {
    if (err instanceof HttpError) {
      const status = err.response?.statusCode;
      if (status === 404 || status === 400) {
        return Result.err('unsupported-api');
      }
    }

    return Result.err(err);
  });
}
