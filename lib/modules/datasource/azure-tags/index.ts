import { cache } from '../../../util/cache/package/decorator';
import type { PackageCacheNamespace } from '../../../util/cache/package/namespaces';
import { ensureTrailingSlash } from '../../../util/url';
import * as azureApi from '../../platform/azure/azure-got-wrapper';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export class AzureTagsDatasource extends Datasource {
  static readonly id = 'azure-tags';

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
    const azureApiGit = await azureApi.gitApi();

    const azureTags = await azureApiGit.getRefs(repo, undefined, 'tags');

    // Filter out tags that do not have a name
    const filteredTags = azureTags.filter((tag) => tag.name);

    const dependency: ReleaseResult = {
      sourceUrl: AzureTagsDatasource.getSourceUrl(repo, registryUrl!),
      registryUrl,
      releases: filteredTags.map((tag) => ({
        version: tag.name!,
        gitRef: tag.name!,
        releaseTimestamp: null,
      })),
    };

    return dependency;
  }
}
