import type { BranchUpgradeConfig } from '../../../../../types';
import { ChangeLogSource } from '../source';

export class GitLabChangeLogSource extends ChangeLogSource {
  constructor() {
    super('gitlab', 'gitlab-tags');
  }

  getAPIBaseUrl(config: BranchUpgradeConfig): string {
    return this.getBaseUrl(config) + 'api/v4/';
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
    return repository.split('/').length >= 2;
  }
}
