import { logger } from '../../../logger/index.ts';
import { buildCacheKey } from '../../../util/cache/package/key.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { adoptiumRegistryUrl, getAdoptiumReleases } from './adoptium.ts';
import { datasource, parsePackage, usesGraalvmRegistry } from './common.ts';
import { getGraalvmReleases, graalvmRegistryUrl } from './graalvm.ts';

export class JavaVersionDatasource extends Datasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  override getDefaultRegistryUrls(packageName: string): string[] {
    return usesGraalvmRegistry(packageName)
      ? [graalvmRegistryUrl]
      : [adoptiumRegistryUrl];
  }

  override supportsCustomRegistry(packageName: string): boolean {
    return usesGraalvmRegistry(packageName);
  }

  private async fetchReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const pkgConfig = parsePackage(packageName);
    logger.trace(
      { registryUrl, packageName, pkgConfig },
      'fetching java release',
    );

    try {
      const { vendor } = pkgConfig;
      if (vendor !== 'adoptium') {
        const effectiveRegistryUrl = registryUrl ?? graalvmRegistryUrl;
        return await getGraalvmReleases(
          this.http,
          { ...pkgConfig, vendor },
          effectiveRegistryUrl,
        );
      }

      // Default to Adoptium
      return await getAdoptiumReleases(this.http, pkgConfig);
    } catch (err) {
      this.handleGenericErrors(err);
    }
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return this.cached(
      {
        key: buildCacheKey(config.registryUrl, config.packageName),
        public: true,
        fallback: true,
      },
      () => this.fetchReleases(config),
    );
  }
}
