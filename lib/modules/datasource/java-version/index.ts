import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { HttpError } from '../../../util/http/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { adoptiumRegistryUrl, getAdoptiumReleases } from './adoptium.ts';
import { datasource, parsePackage } from './common.ts';
import { getGraalvmReleases, graalvmRegistryUrl } from './graalvm.ts';

export class JavaVersionDatasource extends Datasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  override readonly customRegistrySupport = true;

  override readonly defaultRegistryUrls = [adoptiumRegistryUrl];

  override readonly caching = true;

  private async _getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const pkgConfig = parsePackage(packageName);
    logger.trace(
      { registryUrl, packageName, pkgConfig },
      'fetching java release',
    );

    try {
      if (pkgConfig.vendor === 'oracle-graalvm') {
        const effectiveRegistryUrl = registryUrl ?? graalvmRegistryUrl;
        return await getGraalvmReleases(
          this.http,
          pkgConfig,
          effectiveRegistryUrl,
        );
      }

      // Default to Adoptium
      return await getAdoptiumReleases(this.http, pkgConfig);
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.response?.statusCode !== 404) {
          throw new ExternalHostError(err);
        }
        return null;
      }
      this.handleGenericErrors(err);
    }

    return null;
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
