import type { GitRef } from 'azure-devops-node-api/interfaces/GitInterfaces.js';
import type { PackageCacheNamespace } from '../../../util/cache/package/namespaces.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { ensureTrailingSlash } from '../../../util/url.ts';
import * as azureApi from '../../platform/azure/azure-got-wrapper.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';

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

  private async _getReleases({
    registryUrl,
    packageName: repo,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const azureApiGit = await azureApi.gitApi();

    const azureTags = await azureApiGit.getRefs(repo, undefined, 'tags');

    // Filter out tags that do not have a name
    const filteredTags = azureTags.filter((tag: GitRef) => tag.name);

    const dependency: ReleaseResult = {
      sourceUrl: AzureTagsDatasource.getSourceUrl(repo, registryUrl!),
      registryUrl,
      releases: filteredTags.map((tag: GitRef) => ({
        version: tag.name!,
        gitRef: tag.name!,
        releaseTimestamp: null,
      })),
    };

    return dependency;
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: AzureTagsDatasource.cacheNamespace,
        key: AzureTagsDatasource.getCacheKey(
          config.registryUrl!,
          config.packageName,
          'tags',
        ),
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}
