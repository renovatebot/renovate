import type { BranchUpgradeConfig } from '../../../../../types.ts';
import { ChangeLogSource } from '../source.ts';
import type { ChangeLogPlatform } from '../types.ts';

export class GiteaChangeLogSource extends ChangeLogSource {
  constructor(
    platform: ChangeLogPlatform = 'gitea',
    datasource: 'forgejo-tags' | 'gitea-tags' = 'gitea-tags',
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
