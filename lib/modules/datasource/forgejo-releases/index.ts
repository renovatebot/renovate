import type { DatasourceName } from '../../../datasource-list.generated.ts';
import type { NonEmptyArray } from '../../../types/index.ts';
import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import { ForgejoHttp } from '../../../util/http/forgejo.ts';
import { GiteaReleasesDatasource } from '../gitea-releases/index.ts';

/**
 * Forgejo is a fork of Gitea and serves the same API, so the lookup is
 * inherited and only the identity of the datasource differs.
 */
export class ForgejoReleasesDatasource extends GiteaReleasesDatasource {
  static override readonly id: DatasourceName = 'forgejo-releases';

  static override readonly defaultRegistryUrls: NonEmptyArray<string> = [
    'https://code.forgejo.org',
  ];

  override getDefaultRegistryUrls(_packageName: string): NonEmptyArray<string> {
    return ForgejoReleasesDatasource.defaultRegistryUrls;
  }

  protected override readonly cacheNamespace: PackageCacheNamespace =
    'datasource-forgejo-releases';

  constructor() {
    super(
      ForgejoReleasesDatasource.id,
      new ForgejoHttp(ForgejoReleasesDatasource.id),
    );
  }
}
