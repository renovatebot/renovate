import { getSourceUrl as githubSourceUrl } from '../../../util/github/url.ts';
import { getSourceUrl as gitlabSourceUrl } from '../../../util/gitlab/url.ts';
import { BitbucketTagsDatasource } from '../bitbucket-tags/index.ts';
import { ForgejoTagsDatasource } from '../forgejo-tags/index.ts';
import { GitTagsDatasource } from '../git-tags/index.ts';
import { GiteaTagsDatasource } from '../gitea-tags/index.ts';
import { GithubTagsDatasource } from '../github-tags/index.ts';
import { GitlabTagsDatasource } from '../gitlab-tags/index.ts';
import type { GoTagDatasource } from './types.ts';

let tagDatasources: Record<string, GoTagDatasource> | undefined;

/**
 * Looks up how to resolve a module which {@link BaseGoDatasource.getDatasource}
 * has attributed to the `*-tags` datasource with the given id, or `undefined`
 * when the `go` datasource cannot resolve that datasource.
 *
 * The datasources are built once and shared by every `go` lookup, so that a
 * Renovate run holds a single instance - and therefore a single HTTP client -
 * per git host.
 */
export function getGoTagDatasource(
  datasource: string,
): GoTagDatasource | undefined {
  tagDatasources ??= {
    [BitbucketTagsDatasource.id]: {
      api: new BitbucketTagsDatasource(),
      getSourceUrl: BitbucketTagsDatasource.getSourceUrl,
    },
    [ForgejoTagsDatasource.id]: {
      api: new ForgejoTagsDatasource(),
      // `GiteaDatasource.getSourceUrl()` reads `defaultRegistryUrls` off the
      // class it is called on, so the reference has to stay bound to it.
      getSourceUrl: ForgejoTagsDatasource.getSourceUrl.bind(
        ForgejoTagsDatasource,
      ),
    },
    [GitTagsDatasource.id]: {
      api: new GitTagsDatasource(),
    },
    [GiteaTagsDatasource.id]: {
      api: new GiteaTagsDatasource(),
      getSourceUrl: GiteaTagsDatasource.getSourceUrl.bind(GiteaTagsDatasource),
    },
    [GithubTagsDatasource.id]: {
      api: new GithubTagsDatasource(),
      getSourceUrl: githubSourceUrl,
    },
    [GitlabTagsDatasource.id]: {
      api: new GitlabTagsDatasource(),
      getSourceUrl: gitlabSourceUrl,
    },
  };

  return tagDatasources[datasource];
}
