import type { AzureTag } from '../../../types/platform/azure';
import { cache } from '../../../util/cache/package/decorator';
import { AzureHttp } from '../../../util/http/azure';
import { ensureTrailingSlash } from '../../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export class AzureTagsDatasource extends Datasource {
  azureHttp = new AzureHttp(AzureTagsDatasource.id);

  static readonly id = 'azure-tags';

  static readonly registryStrategy = 'first';

  static readonly defaultRegistryUrls = ['https://dev.azure.com'];

  static readonly cacheNamespace = `datasource-${AzureTagsDatasource.id}`;

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

  static getRegistryURL(registryUrl?: string): string {
    return registryUrl ?? this.defaultRegistryUrls[0];
  }

  @cache({
    namespace: AzureTagsDatasource.cacheNamespace,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      AzureTagsDatasource.getCacheKey(
        AzureTagsDatasource.getRegistryURL(registryUrl),
        packageName,
        'tags'
      ),
  })
  async getReleases({
    registryUrl,
    packageName: repo,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const url = `${AzureTagsDatasource.getRegistryURL(
      registryUrl
    )}/_apis/git/repositories/${repo}/refs?filter=tags&$top=100&api-version=7.0`;
    const azureTags = (await this.azureHttp.getJsonPaginated<AzureTag>(url))
      .body.value;

    const dependency: ReleaseResult = {
      sourceUrl: AzureTagsDatasource.getSourceUrl(
        repo,
        AzureTagsDatasource.getRegistryURL(registryUrl)
      ),
      registryUrl,
      releases: azureTags.map(({ name }) => ({
        version: name,
        gitRef: name,
        releaseTimestamp: null,
      })),
    };

    return dependency;
  }
}
