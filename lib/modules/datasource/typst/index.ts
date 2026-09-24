import { logger } from '../../../logger/index.ts';
import type { NonEmptyArray } from '../../../types/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { PackageHttpCacheProvider } from '../../../util/http/cache/package-http-cache-provider.ts';
import { id as semver } from '../../versioning/semver-coerced/index.ts';
import { RegistryDatasource } from '../datasource.ts';
import type { RegistryGetReleasesConfig, ReleaseResult } from '../types.ts';
import { Registry } from './schema.ts';

export class TypstDatasource extends RegistryDatasource {
  static readonly id = 'typst';

  override supportsCustomRegistry(_packageName: string): boolean {
    return false;
  }

  override getDefaultRegistryUrls(_packageName: string): NonEmptyArray<string> {
    return ['https://packages.typst.org/preview/index.json'];
  }

  override defaultVersioning = semver;

  constructor() {
    super(TypstDatasource.id);
  }

  private async _getReleases({
    packageName,
  }: RegistryGetReleasesConfig): Promise<ReleaseResult | null> {
    const [, pkg] = packageName.split('/');

    const [registryUrl] = this.getDefaultRegistryUrls('');

    const cacheProvider = new PackageHttpCacheProvider({
      namespace: 'datasource-typst:cache-provider',
      checkAuthorizationHeader: false,
      checkCacheControlHeader: false,
    });

    const { body: registry } = await this.http.getJson(
      registryUrl,
      { cacheProvider },
      Registry,
    );

    const result = registry[pkg];
    if (!result) {
      return null;
    }

    result.registryUrl = registryUrl;
    return result;
  }

  override async getReleases(
    config: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    const [namespace] = config.packageName.split('/');
    if (namespace !== 'preview') {
      logger.debug(`Unsupported namespace for @${config.packageName}`);
      return null;
    }

    return withCache(
      {
        namespace: `datasource-${TypstDatasource.id}:registry-releases`,
        key: config.packageName,
        fallback: true,
        cacheable: true,
      },
      () => this._getReleases(config),
    );
  }
}
