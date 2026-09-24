import type { DatasourceName } from '../../../datasource-list.generated.ts';
import type { NonEmptyArray } from '../../../types/index.ts';
import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import { ForgejoHttp } from '../../../util/http/forgejo.ts';
import { GiteaTagsDatasource } from '../gitea-tags/index.ts';

/**
 * Forgejo is a fork of Gitea and serves the same API, so the lookup is
 * inherited and only the identity of the datasource differs.
 */
export class ForgejoTagsDatasource extends GiteaTagsDatasource {
  static override readonly id: DatasourceName = 'forgejo-tags';

  static override readonly defaultRegistryUrls: NonEmptyArray<string> = [
    'https://code.forgejo.org',
  ];

  override getDefaultRegistryUrls(_packageName: string): NonEmptyArray<string> {
    return ForgejoTagsDatasource.defaultRegistryUrls;
  }

  protected override readonly cacheNamespace: PackageCacheNamespace =
    'datasource-forgejo-tags';

  constructor() {
    super(ForgejoTagsDatasource.id, new ForgejoHttp(ForgejoTagsDatasource.id));
  }
}
