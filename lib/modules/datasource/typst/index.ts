import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { PackageHttpCacheProvider } from '../../../util/http/cache/package-http-cache-provider';
import { GithubHttp } from '../../../util/http/github';
import {
  id as semver,
  api as semverApi,
} from '../../versioning/semver-coerced';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { SourceUrl, Versions } from './schema';

export class TypstDatasource extends Datasource {
  static readonly id = 'typst';

  override readonly defaultRegistryUrls = ['https://api.github.com'];

  override defaultVersioning = semver;

  githubHttp: GithubHttp;

  constructor() {
    super(TypstDatasource.id);
    this.githubHttp = new GithubHttp(TypstDatasource.id);
  }

  @cache({
    namespace: `datasource-${TypstDatasource.id}:releases`,
    key: ({ packageName }: GetReleasesConfig) => packageName,
    ttlMinutes: 180,
  })
  override async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const [namespace, pkg] = packageName.split('/');
    if (namespace !== 'preview') {
      logger.debug(`Unsupported namespace for @${packageName}`);
      return null;
    }

    const versionsUrl = `/repos/typst/packages/contents/packages/preview/${pkg}`;

    const cacheProvider = new PackageHttpCacheProvider({
      namespace: 'datasource-typst:cache-provider',
      checkAuthorizationHeader: false,
      checkCacheControlHeader: false,
      softTtlMinutes: 180,
    });

    const { body: versions } = await this.githubHttp.getJson(
      versionsUrl,
      {
        cacheProvider,
        baseUrl: registryUrl,
      },
      Versions,
    );

    const latestRelease = versions
      .sort((x, y) => semverApi.sortVersions(x, y))
      .at(-1);

    if (!latestRelease) {
      return null;
    }
    const releases: Release[] = versions.map((version) => ({ version }));
    const result: ReleaseResult = { releases };

    const manifestUrl = `/repos/typst/packages/contents/packages/preview/${pkg}/${latestRelease}/typst.toml`;
    const { body: sourceUrl } = await this.githubHttp.getJson(
      manifestUrl,
      {
        cacheProvider,
        baseUrl: registryUrl,
      },
      SourceUrl,
    );

    if (sourceUrl) {
      result.sourceUrl = sourceUrl;
    }

    return result;
  }
}
