import type { DatasourceName } from '../../../datasource-list.generated.ts';
import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import type { GiteaHttp } from '../../../util/http/gitea.ts';
import { GiteaDatasource } from '../gitea-tags/base.ts';
import { getApiUrl } from '../gitea-tags/util.ts';
import type { GetReleasesConfig, GitHostTag } from '../types.ts';
import { Releases } from './schema.ts';

export class GiteaReleasesDatasource extends GiteaDatasource {
  static readonly id: DatasourceName = 'gitea-releases';

  protected readonly cacheNamespace: PackageCacheNamespace =
    'datasource-gitea-releases';

  /** Subclasses for other Gitea-compatible hosts pass their own id and client. */
  constructor(id: string = GiteaReleasesDatasource.id, http?: GiteaHttp) {
    super(id, 'published_at', http);
  }

  // fetchTags fetches the releases of the repository, each named by its tag
  protected async fetchTags({
    registryUrl,
    packageName: repo,
  }: GetReleasesConfig): Promise<GitHostTag[]> {
    const url = `${getApiUrl(this.getRegistryUrl(registryUrl))}repos/${repo}/releases?draft=false`;
    const releases = (
      await this.http.getJson(
        url,
        {
          paginate: true,
        },
        Releases,
      )
    ).body;

    return releases.map(({ tag_name, published_at, prerelease }) => ({
      version: tag_name,
      releaseTimestamp: published_at,
      isStable: !prerelease,
    }));
  }
}
