import { ChangeLogSource } from './source';

export class GitLabChangeLogSource extends ChangeLogSource {
  constructor() {
    super('gitlab', 'gitlab-tags');
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
    return `${baseUrl}${repository}/compare/${prevHead}...${nextHead}`;
  }
}
