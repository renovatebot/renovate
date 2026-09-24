import { withCache } from '../../../util/cache/package/with-cache.ts';
import { GitlabHttp } from '../../../util/http/gitlab.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { Datasource } from '../datasource.ts';
import type {
  RegistryGetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types.ts';
import { GitlabReleases } from './schema.ts';

export class GitlabReleasesDatasource extends Datasource<GitlabHttp> {
  static readonly id = 'gitlab-releases';

  override getDefaultRegistryUrls(_packageName: string): string[] {
    return ['https://gitlab.com'];
  }

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `released_at` field in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  constructor() {
    super(
      GitlabReleasesDatasource.id,
      new GitlabHttp(GitlabReleasesDatasource.id),
    );
  }

  private async _getReleases({
    registryUrl,
    packageName,
  }: RegistryGetReleasesConfig): Promise<ReleaseResult | null> {
    const urlEncodedRepo = encodeURIComponent(packageName);
    const apiUrl = `${registryUrl}/api/v4/projects/${urlEncodedRepo}/releases`;

    try {
      const gitlabReleasesResponse = (
        await this.http.getJson(apiUrl, GitlabReleases)
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

  getReleases(
    config: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${GitlabReleasesDatasource.id}`,
        key: `${config.registryUrl}/${config.packageName}`,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}
