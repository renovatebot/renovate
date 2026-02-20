import type { BranchUpgradeConfig } from '../../../../../types.ts';
import { ChangeLogSource } from '../source.ts';

export class BitbucketChangeLogSource extends ChangeLogSource {
  constructor() {
    super('bitbucket', 'bitbucket-tags');
  }

  getAPIBaseUrl(_config: BranchUpgradeConfig): string {
    return 'https://api.bitbucket.org/';
  }

  getCompareURL(
    baseUrl: string,
    repository: string,
    prevHead: string,
    nextHead: string,
  ): string {
    return `${baseUrl}${repository}/branches/compare/${nextHead}%0D${prevHead}`;
  }
}
