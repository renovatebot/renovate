import { regEx } from '../../../../../../util/regex';
import { parseUrl } from '../../../../../../util/url';
import type { BranchUpgradeConfig } from '../../../../../types';
import { ChangeLogSource } from '../source';

const repositoryRegex = regEx(
  '^/(?:scm|projects)?/?(?<project>[^\\/]+)/(?:repos/)?(?<repo>[^\\/]+?)(?:\\.git|/.*|$)',
);

export class BitbucketServerChangeLogSource extends ChangeLogSource {
  constructor() {
    super('bitbucket-server', 'bitbucket-server-tags');
  }

  getAPIBaseUrl(config: BranchUpgradeConfig): string {
    return `${this.getBaseUrl(config)}rest/api/1.0/`;
  }

  getCompareURL(
    baseUrl: string,
    repository: string,
    prevHead: string,
    nextHead: string,
  ): string {
    const [projectKey, repositorySlug] = repository.split('/');
    return `${baseUrl}projects/${projectKey}/repos/${repositorySlug}/compare/commits?sourceBranch=${nextHead}&targetBranch=${prevHead}`;
  }

  override getRepositoryFromUrl(config: BranchUpgradeConfig): string {
    const parsedUrl = parseUrl(config.sourceUrl);
    if (parsedUrl) {
      const match = repositoryRegex.exec(parsedUrl.pathname);
      if (match?.groups) {
        return `${match.groups.project}/${match.groups.repo}`;
      }
    }

    return '';
  }
}
