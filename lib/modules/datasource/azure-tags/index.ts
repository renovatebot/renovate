import { cache } from '../../../util/cache/package/decorator';
import type { PackageCacheNamespace } from '../../../util/cache/package/namespaces';
import { AzureHttp } from '../../../util/http/azure';
import { ensureTrailingSlash } from '../../../util/url';
import type { PagedResult } from '../../platform/azure/types';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { AzureTag } from './schema';

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
    const url = `${registryUrl!}/_apis/git/repositories/${repo}/refs?filter=tags&$top=100&api-version=7.0`;
    const azureTags = (
      await this.http.getJsonUnchecked<PagedResult<AzureTag>>(url, {
        paginate: true,
      })
    ).body.value;

    const dependency: ReleaseResult = {
      sourceUrl: AzureTagsDatasource.getSourceUrl(repo, registryUrl!),
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
