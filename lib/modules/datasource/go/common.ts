import { getSourceUrl as githubSourceUrl } from '../../../util/github/url';
import { BitbucketTagsDatasource } from '../bitbucket-tags';
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

    if (datasource === GithubTagsDatasource.id) {
      return githubSourceUrl(packageName, registryUrl);
    }

    if (datasource === GitlabTagsDatasource.id) {
      return gitlabSourceUrl(packageName, registryUrl);
    }

    if (datasource === BitbucketTagsDatasource.id) {
      return BitbucketTagsDatasource.getSourceUrl(packageName, registryUrl);
    }
  }

  // istanbul ignore next
  return undefined;
}
