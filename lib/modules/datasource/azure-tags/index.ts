import type { GitRef } from 'azure-devops-node-api/interfaces/GitInterfaces.js';
import type { PackageCacheNamespace } from '../../../util/cache/package/namespaces.ts';
import { ensureTrailingSlash } from '../../../util/url.ts';
import * as azureApi from '../../platform/azure/azure-got-wrapper.ts';
import { GitHostTagsDatasource } from '../git-host-tags.ts';
import type { GetReleasesConfig, GitHostTag } from '../types.ts';

export class AzureTagsDatasource extends GitHostTagsDatasource {
  static readonly id = 'azure-tags';

  protected readonly cacheNamespace: PackageCacheNamespace = `datasource-${AzureTagsDatasource.id}`;

  constructor() {
    super(AzureTagsDatasource.id);
  }

  getRegistryUrl(registryUrl?: string): string {
    // the Azure DevOps organization URL is always known
    return registryUrl!;
  }

  getSourceUrl(packageName: string, registryUrl?: string): string {
    const normalizedUrl = ensureTrailingSlash(this.getRegistryUrl(registryUrl));
    return `${normalizedUrl}_git/${packageName}`;
  }

  protected async fetchTags({
    packageName: repo,
  }: GetReleasesConfig): Promise<GitHostTag[]> {
    const azureApiGit = await azureApi.gitApi();

    const azureTags = await azureApiGit.getRefs(repo, undefined, 'tags');

    // Filter out tags that do not have a name
    const filteredTags = azureTags.filter((tag: GitRef) => tag.name);

    return filteredTags.map((tag: GitRef) => ({
      version: tag.name!,
      releaseTimestamp: null,
    }));
  }
}
