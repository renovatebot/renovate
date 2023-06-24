import { cache } from '../../../../../util/cache/package/decorator';
import { getTags } from './gitlab';
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
    return `${baseUrl}${repository}/compare/${prevHead}...${nextHead}`;
  }

  @cache({
    namespace: `changelog-gitlab-release`,
    key: (endpoint: string, repository: string) =>
      `getTags-${endpoint}-${repository}`,
  })
  getTags(endpoint: string, repository: string): Promise<string[]> {
    return getTags(endpoint, repository);
  }
}
