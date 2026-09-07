import { ChangeLogSource } from '../source.ts';

export class BitbucketChangeLogSource extends ChangeLogSource {
  constructor() {
    super('bitbucket');
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
