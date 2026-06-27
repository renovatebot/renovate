import { regEx } from '../../../../util/regex.ts';
import { GithubTagsDatasource } from '../../../datasource/github-tags/index.ts';
import type { SourceData } from '../types.ts';

const archiveRegex = regEx(
  /^\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/archive\/(?:refs\/tags\/)?(?<version>[^/]+?)(?:\.tar\.gz|\.tar\.bz2|\.tar\.xz|\.zip)$/,
);
const releaseRegex = regEx(
  /^\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/releases\/download\/(?<version>[^/]+)\//,
);

export function parseGitHubUrl(
  parsedUrl: URL,
  expandedUrl: string,
): SourceData | null {
  const archiveMatch = archiveRegex.exec(parsedUrl.pathname);
  if (archiveMatch?.groups) {
    const { owner, repo, version } = archiveMatch.groups;
    return {
      url: expandedUrl,
      version,
      owner,
      repo,
      datasource: GithubTagsDatasource.id,
    };
  }

  const releaseMatch = releaseRegex.exec(parsedUrl.pathname);
  if (releaseMatch?.groups) {
    const { owner, repo, version } = releaseMatch.groups;
    return {
      url: expandedUrl,
      version,
      owner,
      repo,
      datasource: GithubTagsDatasource.id,
    };
  }

  return null;
}
