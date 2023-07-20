import type { Http, SafeJsonError } from '../../../util/http';
import type { AsyncResult } from '../../../util/result';
import { joinUrlParts } from '../../../util/url';
import type { ReleaseResult } from '../types';
import { GemMetadata, GemVersions } from './schema';

export function getV1Releases(
  http: Http,
  registryUrl: string,
  packageName: string
): AsyncResult<ReleaseResult, SafeJsonError> {
  return http
    .getJsonSafe(
      joinUrlParts(registryUrl, '/api/v1/versions', `${packageName}.json`),
      GemVersions
    )
    .transform(
      (releases): Promise<ReleaseResult> =>
        http
          .getJsonSafe(
            joinUrlParts(registryUrl, '/api/v1/gems', `${packageName}.json`),
            GemMetadata
          )
          .transform(({ changelogUrl, sourceUrl, homepage }) => {
            const result: ReleaseResult = { releases };

            if (changelogUrl) {
              result.changelogUrl = changelogUrl;
            }

            if (sourceUrl) {
              result.sourceUrl = sourceUrl;
            }

            if (homepage) {
              result.homepage = homepage;
            }

            return result;
          })
          .unwrap({ releases })
    );
}
