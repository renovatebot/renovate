import { PLATFORM_FAMILIES } from '../../../constants/platforms.ts';
import { detectPlatform } from '../../../util/common.ts';
import { getHttpUrl, parseGitUrl } from '../../../util/git/url.ts';
import { GitHostTagsDigestDatasource } from '../git-host-tags.ts';
import type { PlatformTagsLookup } from './types.ts';

/**
 * The registered datasource with the given id, or `null` when no datasource
 * with that id looks up tags and digests through a platform API.
 */
export async function getPlatformTagsDatasource(
  id: string,
): Promise<GitHostTagsDigestDatasource | null> {
  // the registry instantiates every datasource, this one included, so it can
  // only be loaded once this module is
  const { getDatasources } = await import('../index.ts');

  const datasource = getDatasources().get(id);
  if (!(datasource instanceof GitHostTagsDigestDatasource)) {
    return null;
  }

  return datasource;
}

/**
 * Resolves a repository URL to the platform datasource which can serve it
 * through the platform's API, with the `registryUrl` and `packageName` that
 * datasource expects, or `null` when the host is not a known platform or the
 * URL does not name a repository.
 */
export async function resolvePlatformTagsLookup(
  url: string,
): Promise<PlatformTagsLookup | null> {
  // `detectPlatform()` reads a URL, which an scp-style `git@host:repo` clone
  // URL is not
  let httpUrl: string;
  try {
    httpUrl = getHttpUrl(url);
  } catch {
    // not a git URL at all, so no platform either
    return null;
  }

  const family = detectPlatform(httpUrl);
  if (!family) {
    return null;
  }

  // Azure DevOps and Bitbucket Data Center lay out their repository URLs
  // differently from `<origin>/<owner>/<repo>`, so their repositories are read
  // with `git ls-remote`.
  if (family === 'azure' || family === 'bitbucket-server') {
    return null;
  }

  const id = PLATFORM_FAMILIES[family].tagsDatasource;
  const datasource = await getPlatformTagsDatasource(id);
  if (!datasource) {
    return null;
  }

  const { host, full_name: packageName } = parseGitUrl(url);
  // a repository path has at least an owner and a name
  if (!packageName.includes('/')) {
    return null;
  }

  return { id, datasource, registryUrl: `https://${host}`, packageName };
}
