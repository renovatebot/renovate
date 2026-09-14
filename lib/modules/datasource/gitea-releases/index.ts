import type { DatasourceName } from '../../../datasource-list.generated.ts';
import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { GiteaDatasource } from '../gitea-tags/base.ts';
import { getApiUrl, getCacheKey, getSourceUrl } from '../gitea-tags/util.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { Releases } from './schema.ts';

export class GiteaReleasesDatasource extends GiteaDatasource {
  static readonly id: DatasourceName = 'gitea-releases';

  override readonly defaultRegistryUrls =
    GiteaReleasesDatasource.defaultRegistryUrls;

  protected readonly cacheNamespace: PackageCacheNamespace =
    'datasource-gitea-releases';

  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `published_at` field in the results.';

  /** Subclasses for other Gitea-compatible hosts pass their own id. */
  constructor(id: string = GiteaReleasesDatasource.id) {
    super(id);
  }

  // getReleases fetches list of releases for the repository
  private async _getReleases(
    registryUrl: string,
    repo: string,
  ): Promise<ReleaseResult | null> {
    const url = `${getApiUrl(registryUrl)}repos/${repo}/releases?draft=false`;
    const releases = (
      await this.http.getJson(
        url,
        {
          paginate: true,
        },
        Releases,
      )
    ).body;

    const dependency: ReleaseResult = {
      sourceUrl: getSourceUrl(repo, registryUrl),
      registryUrl,
      releases: releases.map(({ tag_name, published_at, prerelease }) => ({
        version: tag_name,
        gitRef: tag_name,
        releaseTimestamp: published_at,
        isStable: !prerelease,
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
        key: getCacheKey(resolvedUrl, repo, 'releases'),
        fallback: true,
        cacheable: this.isPublicRegistry(resolvedUrl),
      },
      () => this._getReleases(resolvedUrl, repo),
    );
  }
}
