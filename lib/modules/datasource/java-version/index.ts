import { logger } from '../../../logger/index.ts';
import type { NonEmptyArray } from '../../../types/index.ts';
import { RegistryDatasource } from '../datasource.ts';
import type { RegistryGetReleasesConfig, ReleaseResult } from '../types.ts';
import { adoptiumRegistryUrl, getAdoptiumReleases } from './adoptium.ts';
import { datasource, parsePackage } from './common.ts';
import { getGraalvmReleases, graalvmRegistryUrl } from './graalvm.ts';

export class JavaVersionDatasource extends RegistryDatasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  override getDefaultRegistryUrls(packageName: string): NonEmptyArray<string> {
    return packageName.includes('oracle-graalvm')
      ? [graalvmRegistryUrl]
      : [adoptiumRegistryUrl];
  }

  override supportsCustomRegistry(packageName: string): boolean {
    return packageName.includes('oracle-graalvm');
  }

  private async fetchReleases({
    registryUrl,
    packageName,
  }: RegistryGetReleasesConfig): Promise<ReleaseResult | null> {
    const pkgConfig = parsePackage(packageName);
    logger.trace(
      { registryUrl, packageName, pkgConfig },
      'fetching java release',
    );

    try {
      if (pkgConfig.vendor === 'oracle-graalvm') {
        return await getGraalvmReleases(this.http, pkgConfig, registryUrl);
      }

      // Default to Adoptium
      return await getAdoptiumReleases(this.http, pkgConfig);
    } catch (err) {
      this.handleGenericErrors(err);
    }
  }

  getReleases(
    config: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return this.cached(
      {
        key: `${config.registryUrl}:${config.packageName}`,
        cacheable: true,
        fallback: true,
      },
      () => this.fetchReleases(config),
    );
  }
}
