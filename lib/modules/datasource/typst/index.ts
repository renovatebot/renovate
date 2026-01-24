import { logger } from '../../../logger';
import { cached } from '../../../util/cache/package/cached';
import { PackageHttpCacheProvider } from '../../../util/http/cache/package-http-cache-provider';
import { id as semver } from '../../versioning/semver-coerced';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { Registry } from './schema';

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
    return cached(
      {
        namespace: `datasource-${TypstDatasource.id}:registry-releases`,
        key: config.packageName,
      },
      () => this._getReleases(config),
    );
  }
}
