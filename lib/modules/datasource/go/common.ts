import { getSourceUrl as githubSourceUrl } from '../../../util/github/url';
import { BitbucketTagsDatasource } from '../bitbucket-tags';
import { ForgejoTagsDatasource } from '../forgejo-tags';
import { GiteaTagsDatasource } from '../gitea-tags';
import { GithubTagsDatasource } from '../github-tags';
import { GitlabTagsDatasource } from '../gitlab-tags';
import { getSourceUrl as gitlabSourceUrl } from '../gitlab-tags/util';

import type { DataSource } from './types';

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
