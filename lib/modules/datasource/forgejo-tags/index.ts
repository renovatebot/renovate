import type { DatasourceName } from '../../../datasource-list.generated.ts';
import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import { ForgejoHttp } from '../../../util/http/forgejo.ts';
import { GiteaTagsDatasource } from '../gitea-tags/index.ts';

/**
 * Forgejo is a fork of Gitea and serves the same API, so the lookup is
 * inherited and only the identity of the datasource differs.
 */
export class ForgejoTagsDatasource extends GiteaTagsDatasource {
  static override readonly id: DatasourceName = 'forgejo-tags';

  static override readonly defaultRegistryUrls = ['https://code.forgejo.org'];

  override readonly defaultRegistryUrls =
    ForgejoTagsDatasource.defaultRegistryUrls;

  protected override readonly cacheNamespace: PackageCacheNamespace =
    'datasource-forgejo-tags';

  override http = new ForgejoHttp(ForgejoTagsDatasource.id);

  constructor() {
    super(ForgejoTagsDatasource.id);
  }
}
