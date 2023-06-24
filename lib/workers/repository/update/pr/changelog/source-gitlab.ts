import { ChangeLogSource } from './source';

export class GitLabChangeLogSource extends ChangeLogSource {
  constructor() {
    super('gitlab');
  }

  getAPIBaseUrl(sourceUrl: string): string {
    return this.getBaseUrl(sourceUrl) + 'api/v4/';
  }

  getCompareURL(
    baseUrl: string,
    repository: string,
    prevHead: string,
    nextHead: string
  ): string {
    return `${baseUrl}${repository}/branches/compare/${prevHead}%0D${nextHead}`;
  }
}
