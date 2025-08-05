import type { BranchUpgradeConfig } from '../../../../../types';
import { ChangeLogSource } from '../source';

export class ForgejoChangeLogSource extends ChangeLogSource {
  constructor() {
    super('forgejo', 'forgejo-tags');
  }

  getAPIBaseUrl(config: BranchUpgradeConfig): string {
    return this.getBaseUrl(config) + 'api/v1/';
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
