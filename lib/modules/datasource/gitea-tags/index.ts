import type { DatasourceName } from '../../../datasource-list.generated.ts';
import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { GiteaDatasource } from './base.ts';
import { Tags } from './schema.ts';
import { getApiUrl, getCacheKey, getSourceUrl } from './util.ts';

export class GiteaTagsDatasource extends GiteaDatasource {
  static readonly id: DatasourceName = 'gitea-tags';

  override readonly defaultRegistryUrls =
    GiteaTagsDatasource.defaultRegistryUrls;

  protected readonly cacheNamespace: PackageCacheNamespace =
    'datasource-gitea-tags';

  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `created` field in the results.';

  /** Subclasses for other Gitea-compatible hosts pass their own id. */
  constructor(id: string = GiteaTagsDatasource.id) {
    super(id);
  }

  // getReleases fetches list of tags for the repository
  private async _getReleases(
    registryUrl: string,
    repo: string,
  ): Promise<ReleaseResult | null> {
    const url = `${getApiUrl(registryUrl)}repos/${repo}/tags`;
    const tags = (
      await this.http.getJson(
        url,
        {
          paginate: true,
        },
        Tags,
      )
    ).body;

    const dependency: ReleaseResult = {
      sourceUrl: getSourceUrl(repo, registryUrl),
      registryUrl,
      releases: tags.map(({ name, commit }) => ({
        version: name,
        gitRef: name,
        newDigest: commit.sha,
        releaseTimestamp: commit.created,
      })),
    };

    return dependency;
  }

  getReleases({
    registryUrl,
    packageName: repo,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const resolvedUrl = this.getRegistryUrl(registryUrl);
    return withCache(
      {
        namespace: this.cacheNamespace,
        key: getCacheKey(resolvedUrl, repo, 'tags'),
        fallback: true,
        cacheable: this.isPublicRegistry(resolvedUrl),
      },
      () => this._getReleases(resolvedUrl, repo),
    );
  }
}
