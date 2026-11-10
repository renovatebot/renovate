import type { DatasourceName } from '../../../datasource-list.generated.ts';
import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import type { GiteaHttp } from '../../../util/http/gitea.ts';
import type { GetReleasesConfig, GitHostTag } from '../types.ts';
import { GiteaDatasource } from './base.ts';
import { Tags } from './schema.ts';
import { getApiUrl } from './util.ts';

export class GiteaTagsDatasource extends GiteaDatasource {
  static readonly id: DatasourceName = 'gitea-tags';

  protected readonly cacheNamespace: PackageCacheNamespace =
    'datasource-gitea-tags';

  /** Subclasses for other Gitea-compatible hosts pass their own id and client. */
  constructor(id: string = GiteaTagsDatasource.id, http?: GiteaHttp) {
    super(id, 'created', http);
  }

  // fetchTags fetches list of tags for the repository
  protected async fetchTags({
    registryUrl,
    packageName: repo,
  }: GetReleasesConfig): Promise<GitHostTag[]> {
    const url = `${getApiUrl(this.getRegistryUrl(registryUrl))}repos/${repo}/tags`;
    const tags = (
      await this.http.getJson(
        url,
        {
          paginate: true,
        },
        Tags,
      )
    ).body;

    return tags.map(({ name, commit }) => ({
      version: name,
      newDigest: commit.sha,
      releaseTimestamp: commit.created,
    }));
  }
}
