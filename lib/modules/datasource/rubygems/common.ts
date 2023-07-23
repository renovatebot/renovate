import { assignKeys } from '../../../util/assign-keys';
import { type Http, HttpError, type SafeJsonError } from '../../../util/http';
import { type AsyncResult, Result } from '../../../util/result';
import { joinUrlParts as join } from '../../../util/url';
import type { Release, ReleaseResult } from '../types';
import { GemMetadata, GemVersions } from './schema';

export function getV1Releases(
  http: Http,
  registryUrl: string,
  packageName: string
): AsyncResult<
  ReleaseResult,
  SafeJsonError | 'empty-releases' | 'unsupported-api'
> {
  const fileName = `${packageName}.json`;
  const versionsUrl = join(registryUrl, '/api/v1/versions', fileName);
  const metadataUrl = join(registryUrl, '/api/v1/gems', fileName);

  const addMetadata = (releases: Release[]): Promise<ReleaseResult> =>
    http
      .getJsonSafe(metadataUrl, GemMetadata)
      .transform((metadata) =>
        assignKeys({ releases } as ReleaseResult, metadata, [
          'changelogUrl',
          'sourceUrl',
          'homepage',
        ])
      )
      .unwrap({ releases });

  return http
    .getJsonSafe(versionsUrl, GemVersions)
    .catch((err) => {
      if (err instanceof HttpError) {
        const status = err.response?.statusCode;
        if (status === 404 || status === 400) {
          return Result.err('unsupported-api');
        }
      }

      return Result.err(err);
    })
    .transform((releases) => {
      return releases.length > 0
        ? Result.ok(releases)
        : Result.err('empty-releases');
    })
    .transform(addMetadata);
}
