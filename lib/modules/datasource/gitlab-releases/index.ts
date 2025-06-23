import { cache } from '../../../util/cache/package/decorator';
import { GitlabHttp } from '../../../util/http/gitlab';
import { asTimestamp } from '../../../util/timestamp';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import type { GitlabRelease } from './types';

export class GitlabReleasesDatasource extends Datasource {
  static readonly id = 'gitlab-releases';

  override readonly defaultRegistryUrls = ['https://gitlab.com'];

  static readonly registryStrategy = 'first';

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `released_at` field in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  constructor() {
    super(GitlabReleasesDatasource.id);
    this.http = new GitlabHttp(GitlabReleasesDatasource.id);
  }

  @cache({
    namespace: `datasource-${GitlabReleasesDatasource.id}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      // TODO: types (#22198)
      `${registryUrl}/${packageName}`,
  })
  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next 3 -- should never happen */
    if (!registryUrl) {
      return null;
    }

    const urlEncodedRepo = encodeURIComponent(packageName);
    const apiUrl = `${registryUrl}/api/v4/projects/${urlEncodedRepo}/releases`;

    try {
      const gitlabReleasesResponse = (
        await this.http.getJsonUnchecked<GitlabRelease[]>(apiUrl)
      ).body;

      return {
        sourceUrl: `${registryUrl}/${packageName}`,
        releases: gitlabReleasesResponse.map(({ tag_name, released_at }) => {
          const release: Release = {
            registryUrl,
            gitRef: tag_name,
            version: tag_name,
            releaseTimestamp: asTimestamp(released_at),
          };
          return release;
        }),
      };
    } catch (e) {
      this.handleGenericErrors(e);
    }
  }
}
