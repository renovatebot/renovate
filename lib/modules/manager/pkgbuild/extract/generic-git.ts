import { regEx } from '../../../../util/regex.ts';
import { GitTagsDatasource } from '../../../datasource/git-tags/index.ts';
import type { SourceData } from '../types.ts';

/**
 * Parse generic Git repository URLs
 * Example: https://git.example.com/repo.git or gitea/forgejo archive URLs
 */
const archiveRegex = regEx(
  /^\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/archive\/(?<versionWithExt>.+)$/,
);
const gitRegex = regEx(/\/(?<owner>[^/]+)\/(?<repo>[^/]+)\.git$/);

export function parseGenericGitUrl(
  parsedUrl: URL,
  expandedUrl: string,
): SourceData | null {
  const archiveMatch = archiveRegex.exec(parsedUrl.pathname);
  if (archiveMatch?.groups) {
    const { owner, repo, versionWithExt } = archiveMatch.groups;
    const version = versionWithExt.replace(
      regEx(/\.(tar\.gz|tar\.bz2|tar\.xz|zip)$/),
      '',
    );

    if (!version) {
      return null;
    }

    const gitUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}/${owner}/${repo}.git`;

    return {
      url: expandedUrl,
      version,
      owner,
      repo,
      datasource: GitTagsDatasource.id,
      packageName: gitUrl,
    };
  }

  const gitMatch = gitRegex.exec(parsedUrl.pathname);
  if (gitMatch?.groups) {
    const { owner, repo } = gitMatch.groups;

    return {
      url: expandedUrl,
      owner,
      repo,
      datasource: GitTagsDatasource.id,
      packageName: expandedUrl,
    };
  }

  return null;
}
