import { ChangeLogSource } from './source';

export class BitbucketChangeLogSource extends ChangeLogSource {
  constructor() {
    super('bitbucket');
  }

  protected override getCompareURL(
    baseUrl: string,
    repository: string,
    prevHead: string,
    nextHead: string
  ): string {
    return `${baseUrl}${repository}/branches/compare/${prevHead}%0D${nextHead}`;
  }
}
