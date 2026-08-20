import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { adoptiumRegistryUrl, getAdoptiumReleases } from './adoptium.ts';
import { datasource, parsePackage } from './common.ts';

export class JavaVersionDatasource extends Datasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = [adoptiumRegistryUrl];

  override readonly caching = true;

  private async _getReleases({
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const pkgConfig = parsePackage(packageName);
    logger.trace({ packageName, pkgConfig }, 'fetching java release');

    try {
      return await getAdoptiumReleases(this.http, pkgConfig);
    } catch (err) {
      this.handleGenericErrors(err);
    }
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${datasource}`,
        key: `${config.registryUrl}:${config.packageName}`,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}
