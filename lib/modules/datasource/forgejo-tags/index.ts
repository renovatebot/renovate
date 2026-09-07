import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import { ForgejoHttp } from '../../../util/http/forgejo.ts';
import { GiteaTagsDatasource } from '../gitea-tags/index.ts';

/**
 * Forgejo is a fork of Gitea and exposes the same API, so the lookup logic is
 * inherited and only the identity of the datasource differs.
 */
export class ForgejoTagsDatasource extends GiteaTagsDatasource {
  static override readonly id: string = 'forgejo-tags';

  override http = new ForgejoHttp(ForgejoTagsDatasource.id);

  static override readonly defaultRegistryUrls = ['https://code.forgejo.org'];

  protected override readonly defaultRegistryUrl =
    ForgejoTagsDatasource.defaultRegistryUrls[0];

  protected override readonly cacheNamespace: PackageCacheNamespace =
    'datasource-forgejo-tags';

  constructor() {
    super(ForgejoTagsDatasource.id);
  }
}
