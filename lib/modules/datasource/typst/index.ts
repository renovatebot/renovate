import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { PackageHttpCacheProvider } from '../../../util/http/cache/package-http-cache-provider.ts';
import { id as semver } from '../../versioning/semver-coerced/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { Registry } from './schema.ts';

export class TypstDatasource extends Datasource {
  static readonly id = 'typst';

  override readonly defaultRegistryUrls = [
    'https://packages.typst.org/preview/index.json',
  ];

  override defaultVersioning = semver;

  constructor() {
    super(TypstDatasource.id);
  }

  private async _getReleases({
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const [namespace, pkg] = packageName.split('/');
    if (namespace !== 'preview') {
      logger.debug(`Unsupported namespace for @${packageName}`);
      return null;
    }

    const [registryUrl] = this.defaultRegistryUrls;

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

  override getReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${TypstDatasource.id}:registry-releases`,
        key: config.packageName,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}
