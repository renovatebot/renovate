import { getSourceUrl as githubSourceUrl } from '../../../util/github/url.ts';
import { BitbucketTagsDatasource } from '../bitbucket-tags/index.ts';
import { ForgejoTagsDatasource } from '../forgejo-tags/index.ts';
import { GiteaTagsDatasource } from '../gitea-tags/index.ts';
import { GithubTagsDatasource } from '../github-tags/index.ts';
import { GitlabTagsDatasource } from '../gitlab-tags/index.ts';
import { getSourceUrl as gitlabSourceUrl } from '../gitlab-tags/util.ts';

import type { DataSource } from './types.ts';

export type GoproxyFallback =
  | ',' // WhenNotFoundOrGone
  | '|'; // Always

export function getSourceUrl(
  dataSource?: DataSource | null,
): string | undefined {
  if (dataSource) {
    const { datasource, registryUrl, packageName } = dataSource;

    switch (datasource) {
      case ForgejoTagsDatasource.id:
        return ForgejoTagsDatasource.getSourceUrl(packageName, registryUrl);
      case GiteaTagsDatasource.id:
        return GiteaTagsDatasource.getSourceUrl(packageName, registryUrl);
      case GithubTagsDatasource.id:
        return githubSourceUrl(packageName, registryUrl);
      case GitlabTagsDatasource.id:
        return gitlabSourceUrl(packageName, registryUrl);
      case BitbucketTagsDatasource.id:
        return BitbucketTagsDatasource.getSourceUrl(packageName, registryUrl);
    }
  }

  return undefined;
}
