import type { DatasourceName } from '../../../datasource-list.generated.ts';
import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import { ForgejoHttp } from '../../../util/http/forgejo.ts';
import { GiteaReleasesDatasource } from '../gitea-releases/index.ts';

/**
 * Forgejo is a fork of Gitea and serves the same API, so the lookup is
 * inherited and only the identity of the datasource differs.
 */
export class ForgejoReleasesDatasource extends GiteaReleasesDatasource {
  static override readonly id: DatasourceName = 'forgejo-releases';

  static override readonly defaultRegistryUrls = ['https://code.forgejo.org'];

  override readonly defaultRegistryUrls =
    ForgejoReleasesDatasource.defaultRegistryUrls;

  protected override readonly cacheNamespace: PackageCacheNamespace =
    'datasource-forgejo-releases';

  override http = new ForgejoHttp(ForgejoReleasesDatasource.id);

  constructor() {
    super(ForgejoReleasesDatasource.id);
  }
}
