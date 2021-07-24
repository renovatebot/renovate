import { cache } from '../../util/cache/package/decorator';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import type { GitlabRelease } from './types';

export class GitlabReleasesDatasource extends Datasource {
  static readonly id = 'gitlab-releases';

  static readonly defaultRegistryUrls = ['https://gitlab.com'];

  static readonly registryStrategy = 'first';

  constructor() {
    super(GitlabReleasesDatasource.id);
  }

  @cache({
    namespace: `datasource-${GitlabReleasesDatasource.id}`,
    key: ({ registryUrl, lookupName }: GetReleasesConfig) =>
      `${registryUrl}/${lookupName}`,
  })
  async getReleases({
    registryUrl,
    lookupName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const urlEncodedRepo = encodeURIComponent(lookupName);
    const apiUrl = `${registryUrl}/api/v4/projects/${urlEncodedRepo}/releases`;

    const gitlabReleasesResponse = (
      await this.http.getJson<GitlabRelease[]>(apiUrl)
    ).body;

    return {
      sourceUrl: `${registryUrl}/${urlEncodedRepo}`,
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
  }
}
