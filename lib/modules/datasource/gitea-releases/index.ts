import type { DatasourceName } from '../../../datasource-list.generated.ts';
import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import { GiteaDatasource } from '../gitea-tags/base.ts';
import { getApiUrl, getSourceUrl } from '../gitea-tags/util.ts';
import type { ReleaseResult } from '../types.ts';
import { Releases } from './schema.ts';

export class GiteaReleasesDatasource extends GiteaDatasource {
  static readonly id: DatasourceName = 'gitea-releases';

  protected readonly cacheNamespace: PackageCacheNamespace =
    'datasource-gitea-releases';

  /** Subclasses for other Gitea-compatible hosts pass their own id. */
  constructor(id: string = GiteaReleasesDatasource.id) {
    super(id, {
      cacheKeyType: 'releases',
      releaseTimestampField: 'published_at',
    });
  }

  // _getReleases fetches list of releases for the repository
  protected async _getReleases(
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
}
