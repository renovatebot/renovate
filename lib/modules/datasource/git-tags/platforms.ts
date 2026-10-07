import { PLATFORM_FAMILIES } from '../../../constants/platforms.ts';
import { detectPlatform } from '../../../util/common.ts';
import { parseGitUrl } from '../../../util/git/url.ts';
import { getSourceUrl as githubSourceUrl } from '../../../util/github/url.ts';
import { getSourceUrl as gitlabSourceUrl } from '../../../util/gitlab/url.ts';
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
  platformTagsDatasources ??= {
    [BitbucketTagsDatasource.id]: {
      id: BitbucketTagsDatasource.id,
      api: new BitbucketTagsDatasource(),
      getSourceUrl: BitbucketTagsDatasource.getSourceUrl,
    },
    [ForgejoTagsDatasource.id]: {
      id: ForgejoTagsDatasource.id,
      api: new ForgejoTagsDatasource(),
      // `GiteaDatasource.getSourceUrl()` reads `defaultRegistryUrls` off the
      // class it is called on, so the reference has to stay bound to it.
      getSourceUrl: ForgejoTagsDatasource.getSourceUrl.bind(
        ForgejoTagsDatasource,
      ),
    },
    [GiteaTagsDatasource.id]: {
      id: GiteaTagsDatasource.id,
      api: new GiteaTagsDatasource(),
      getSourceUrl: GiteaTagsDatasource.getSourceUrl.bind(GiteaTagsDatasource),
    },
    [GithubTagsDatasource.id]: {
      id: GithubTagsDatasource.id,
      api: new GithubTagsDatasource(),
      getSourceUrl: githubSourceUrl,
    },
    [GitlabTagsDatasource.id]: {
      id: GitlabTagsDatasource.id,
      api: new GitlabTagsDatasource(),
      getSourceUrl: gitlabSourceUrl,
    },
  };

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
  const family = detectPlatform(url);
  // Azure DevOps and Bitbucket Data Center lay out their repository URLs
  // differently from `<origin>/<owner>/<repo>`, so they have no datasource
  // instance here and their repositories are read with `git ls-remote`.
  const datasource =
    family &&
    getPlatformTagsDatasource(PLATFORM_FAMILIES[family].tagsDatasource);
  if (!datasource) {
    return null;
  }

  const { host, full_name: packageName } = parseGitUrl(url);
  // a repository path has at least an owner and a name
  if (!packageName.includes('/')) {
    return null;
  }

  return { ...datasource, registryUrl: `https://${host}`, packageName };
}
