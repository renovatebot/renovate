import { regEx } from '../../../../../../util/regex';
import { parseUrl } from '../../../../../../util/url';
import type { BranchUpgradeConfig } from '../../../../../types';
import { ChangeLogSource } from '../source';

const subfolderRegex = regEx('(?<subfolder>.+/)(?:projects|scm)/');
const gitUrlRegex = regEx('/(?<project>[^/]+)/(?<repo>[^/]+)\\.git$');
const webUrlRegex = regEx('/projects/(?<project>[^/]+)/repos/(?<repo>[^/]+)');

export class BitbucketServerChangeLogSource extends ChangeLogSource {
  constructor() {
    super('bitbucket-server', 'bitbucket-server-tags');
  }

  override getBaseUrl(config: BranchUpgradeConfig): string {
    const parsedUrl = parseUrl(config.sourceUrl);
    if (parsedUrl?.host) {
      const protocol = parsedUrl.protocol.replace(regEx(/^git\+/), '');
      const match = subfolderRegex.exec(parsedUrl.pathname);
      const subfolder = match?.groups?.subfolder ?? '/';

      return `${protocol}//${parsedUrl.host}${subfolder}`;
    }

    return '';
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
      const repositoryRegex = parsedUrl.pathname.endsWith('.git')
        ? gitUrlRegex
        : webUrlRegex;
      const match = repositoryRegex.exec(parsedUrl.pathname);
      if (match?.groups) {
        return `${match.groups.project}/${match.groups.repo}`;
      }
    }

    return '';
  }
}
