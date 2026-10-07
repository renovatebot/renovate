import { PLATFORM_FAMILIES } from '../../../constants/platforms.ts';
import { detectPlatform } from '../../../util/common.ts';
import { getHttpUrl, parseGitUrl } from '../../../util/git/url.ts';
import { BitbucketTagsDatasource } from '../bitbucket-tags/index.ts';
import { ForgejoTagsDatasource } from '../forgejo-tags/index.ts';
import { GiteaTagsDatasource } from '../gitea-tags/index.ts';
import { GithubTagsDatasource } from '../github-tags/index.ts';
import { GitlabTagsDatasource } from '../gitlab-tags/index.ts';
import type { PlatformTagsDatasource, PlatformTagsLookup } from './types.ts';

let platformTagsDatasources: Record<string, PlatformTagsDatasource> | undefined;

/**
 * The `*-tags` datasource with the given id, or `undefined` when no platform
 * datasource has that id.
 *
 * The datasources are built once and shared by every lookup, so that a
 * Renovate run holds a single instance - and therefore a single HTTP client -
 * per platform.
 */
export function getPlatformTagsDatasource(
  id: string,
): PlatformTagsDatasource | undefined {
  platformTagsDatasources ??= Object.fromEntries(
    [
      new BitbucketTagsDatasource(),
      new ForgejoTagsDatasource(),
      new GiteaTagsDatasource(),
      new GithubTagsDatasource(),
      new GitlabTagsDatasource(),
    ].map((datasource): [string, PlatformTagsDatasource] => [
      datasource.id,
      datasource,
    ]),
  );

  return platformTagsDatasources[id];
}

/**
 * Resolves a repository URL to the platform datasource which can serve it
 * through the platform's API, with the `registryUrl` and `packageName` that
 * datasource expects, or `null` when the host is not a known platform or the
 * URL does not name a repository.
 */
export function resolvePlatformTagsLookup(
  url: string,
): PlatformTagsLookup | null {
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
  // differently from `<origin>/<owner>/<repo>`, so they have no datasource
  // instance here and their repositories are read with `git ls-remote`.
  const id = PLATFORM_FAMILIES[family].tagsDatasource;
  const datasource = getPlatformTagsDatasource(id);
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
