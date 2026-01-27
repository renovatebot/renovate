import { regEx } from '../../../../util/regex.ts';
import { GiteaTagsDatasource } from '../../../datasource/gitea-tags/index.ts';
import type { SourceData } from '../types.ts';

const archiveRegex = regEx(
  /^\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/archive\/(?<versionWithExt>.+)$/,
);

export function parseGiteaUrl(
  parsedUrl: URL,
  expandedUrl: string,
): SourceData | null {
  const archiveMatch = archiveRegex.exec(parsedUrl.pathname);
  if (!archiveMatch?.groups) {
    return null;
  }

  const { owner, repo, versionWithExt } = archiveMatch.groups;
  const version = versionWithExt.replace(
    regEx(/\.(tar\.gz|tar\.bz2|tar\.xz|zip)$/),
    '',
  );

  if (!version) {
    return null;
  }

  return {
    url: expandedUrl,
    version,
    owner,
    repo,
    datasource: GiteaTagsDatasource.id,
    packageName: `${owner}/${repo}`,
    registryUrl: `${parsedUrl.protocol}//${parsedUrl.hostname}`,
  };
}
