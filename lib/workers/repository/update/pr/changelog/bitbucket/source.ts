import URL from 'node:url';
import type { BranchUpgradeConfig } from '../../../../../types';
import { ChangeLogSource } from '../source';

export class BitbucketChangeLogSource extends ChangeLogSource {
  constructor() {
    super('bitbucket', 'bitbucket-tags');
  }

  getAPIBaseUrl(config: BranchUpgradeConfig): string {
    const parsedUrl = URL.parse(config.sourceUrl!);
    const protocol = parsedUrl.protocol!;
    const host = parsedUrl.host!;
    return `${protocol}//api.${host}/`;
  }

  getCompareURL(
    baseUrl: string,
    repository: string,
    prevHead: string,
    nextHead: string
  ): string {
    return `${baseUrl}${repository}/branches/compare/${nextHead}%0D${prevHead}`;
  }
}
