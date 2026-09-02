import { regEx } from '../../../../util/regex.ts';
import { ForgejoTagsDatasource } from '../../../datasource/forgejo-tags/index.ts';
import type { SourceData } from '../types.ts';

/**
 * Parse Forgejo URLs
 * Example: https://code.forgejo.org/owner/repo/archive/v1.0.0.tar.gz
 */
const archiveRegex = regEx(
  /^\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/archive\/(?<versionWithExt>.+)$/,
);

export function parseForgejoUrl(
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
    datasource: ForgejoTagsDatasource.id,
    packageName: `${owner}/${repo}`,
    registryUrl: `${parsedUrl.protocol}//${parsedUrl.hostname}`,
  };
}
