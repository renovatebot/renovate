import { regEx } from '../../../../../../util/regex.ts';
import { joinUrlParts, parseUrl } from '../../../../../../util/url.ts';
import type { BranchUpgradeConfig } from '../../../../../types.ts';
import { ChangeLogSource } from '../source.ts';

const subfolderRegex = regEx('(?<subfolder>.+/)(?:projects|scm)/');
const gitUrlRegex = regEx('/(?<project>[^/]+)/(?<repo>[^/]+)\\.git$');
const webUrlRegex = regEx('/projects/(?<project>[^/]+)/repos/(?<repo>[^/]+)');

export class BitbucketServerChangeLogSource extends ChangeLogSource {
  constructor() {
    super('bitbucket-server');
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

  /**
   * Bitbucket Server does not lay the path out as `<repository>/…`: it expands
   * the repository into `projects/<key>/repos/<slug>` and takes the ref from a
   * query parameter.
   */
  override getNotesSourceUrl(
    baseUrl: string,
    repository: string,
    changelogFile: string,
  ): string {
    const [projectKey, repositorySlug] = repository.split('/');
    return joinUrlParts(
      baseUrl,
      'projects',
      projectKey,
      'repos',
      repositorySlug,
      this.family.webFilePath,
      changelogFile,
      '?at=HEAD',
    );
  }
}
