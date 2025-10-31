import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
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

  @cache({
    namespace: `datasource-${TypstDatasource.id}:registry-releases`,
    key: ({ packageName }: GetReleasesConfig) => packageName,
  })
  override async getReleases({
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

    const releases = registry[pkg];
    if (!releases) {
      return null;
    }

    const result: ReleaseResult = { registryUrl, releases };
    return result;
  }
}
