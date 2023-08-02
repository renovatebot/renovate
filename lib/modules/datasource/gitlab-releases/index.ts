import { cache } from '../../../util/cache/package/decorator';
import { GitlabHttp } from '../../../util/http/gitlab';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import type { GitlabRelease } from './types';

export class GitlabReleasesDatasource extends Datasource {
  static readonly id = 'gitlab-releases';

  override readonly defaultRegistryUrls = ['https://gitlab.com'];

  static readonly registryStrategy = 'first';

  constructor() {
    super(GitlabReleasesDatasource.id);
    this.http = new GitlabHttp(GitlabReleasesDatasource.id);
  }

  @cache({
    namespace: `datasource-${GitlabReleasesDatasource.id}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      // TODO: types (#7154)
      `${registryUrl}/${packageName}`,
  })
  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    const urlEncodedRepo = encodeURIComponent(packageName);
    const apiUrl = `${registryUrl}/api/v4/projects/${urlEncodedRepo}/releases`;

    try {
      const gitlabReleasesResponse = (
        await this.http.getJson<GitlabRelease[]>(apiUrl)
      ).body;

      return {
        sourceUrl: `${registryUrl}/${packageName}`,
        releases: gitlabReleasesResponse.map(({ tag_name, released_at }) => {
          const release: Release = {
            registryUrl,
            gitRef: tag_name,
            version: tag_name,
            releaseTimestamp: released_at,
          };
          return release;
        }),
      };
    } catch (e) {
      this.handleGenericErrors(e);
    }
    /* istanbul ignore next */
    return null;
  }
}
