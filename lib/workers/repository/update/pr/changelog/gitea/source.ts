import type { BranchUpgradeConfig } from '../../../../../types.ts';
import { ChangeLogSource } from '../source.ts';

export class GiteaChangeLogSource extends ChangeLogSource {
  /** Platforms which speak the Gitea API pass their own ids. */
  constructor(
    platform: 'gitea' | 'forgejo' = 'gitea',
    datasource: 'gitea-tags' | 'forgejo-tags' = 'gitea-tags',
  ) {
    super(platform, datasource);
  }

  getAPIBaseUrl(config: BranchUpgradeConfig): string {
    return `${this.getBaseUrl(config)}api/v1/`;
  }

  getCompareURL(
    baseUrl: string,
    repository: string,
    prevHead: string,
    nextHead: string,
  ): string {
    return `${baseUrl}${repository}/compare/${prevHead}...${nextHead}`;
  }

  override hasValidRepository(repository: string): boolean {
    return repository.split('/').length === 2;
  }
}
