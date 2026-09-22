import type { DatasourceName } from '../../../datasource-list.generated.ts';
import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import type { GiteaHttp } from '../../../util/http/gitea.ts';
import type { ReleaseResult } from '../types.ts';
import { GiteaDatasource } from './base.ts';
import { Tags } from './schema.ts';
import { getApiUrl, getSourceUrl } from './util.ts';

export class GiteaTagsDatasource extends GiteaDatasource {
  static readonly id: DatasourceName = 'gitea-tags';

  override readonly defaultRegistryUrls =
    GiteaTagsDatasource.defaultRegistryUrls;

  protected readonly cacheNamespace: PackageCacheNamespace =
    'datasource-gitea-tags';

  /** Subclasses for other Gitea-compatible hosts pass their own id and client. */
  constructor(id: string = GiteaTagsDatasource.id, http?: GiteaHttp) {
    super(id, { cacheKeyType: 'tags', releaseTimestampField: 'created' }, http);
  }

  // _getReleases fetches list of tags for the repository
  protected async _getReleases(
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
}
