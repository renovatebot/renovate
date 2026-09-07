import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import { ForgejoHttp } from '../../../util/http/forgejo.ts';
import { GiteaReleasesDatasource } from '../gitea-releases/index.ts';

/**
 * Forgejo is a fork of Gitea and exposes the same API, so the lookup logic is
 * inherited and only the identity of the datasource differs.
 */
export class ForgejoReleasesDatasource extends GiteaReleasesDatasource {
  static override readonly id: string = 'forgejo-releases';

  override http = new ForgejoHttp(ForgejoReleasesDatasource.id);

  static override readonly defaultRegistryUrls = ['https://code.forgejo.org'];

  protected override readonly defaultRegistryUrl =
    ForgejoReleasesDatasource.defaultRegistryUrls[0];

  protected override readonly cacheNamespace: PackageCacheNamespace =
    'datasource-forgejo-releases';

  constructor() {
    super(ForgejoReleasesDatasource.id);
  }
}
