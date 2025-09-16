import { cache } from '../../../util/cache/package/decorator';
import type { PackageCacheNamespace } from '../../../util/cache/package/namespaces';
import { AzureHttp } from '../../../util/http/azure';
import { ensureTrailingSlash } from '../../../util/url';
import * as azureHelper from '../../platform/azure/azure-helper';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export class AzureTagsDatasource extends Datasource {
  static readonly id = 'azure-tags';

  override http = new AzureHttp(AzureTagsDatasource.id);

  static readonly cacheNamespace: PackageCacheNamespace = `datasource-${AzureTagsDatasource.id}`;

  constructor() {
    super(AzureTagsDatasource.id);
  }

  static getCacheKey(registryUrl: string, repo: string, type: string): string {
    return `${registryUrl}:${repo}:${type}`;
  }

  static getSourceUrl(packageName: string, registryUrl: string): string {
    const normalizedUrl = ensureTrailingSlash(registryUrl);
    return `${normalizedUrl}_git/${packageName}`;
  }

  @cache({
    namespace: AzureTagsDatasource.cacheNamespace,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      AzureTagsDatasource.getCacheKey(registryUrl!, packageName, 'tags'),
  })
  async getReleases({
    registryUrl,
    packageName: repo,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const azureTags = await azureHelper.getTags(repo);

    const dependency: ReleaseResult = {
      sourceUrl: AzureTagsDatasource.getSourceUrl(repo, registryUrl!),
      registryUrl,
      releases: azureTags.map((tag) => ({
        version: tag.name ?? '',
        gitRef: tag.name ?? '',
        releaseTimestamp: null,
      })),
    };

    return dependency;
  }
}
