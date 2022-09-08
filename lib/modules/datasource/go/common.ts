import { getSourceUrl as githubSourceUrl } from '../../../util/github/url';
import { BitBucketTagsDatasource } from '../bitbucket-tags';
import { GithubTagsDatasource } from '../github-tags';
import { GitlabTagsDatasource } from '../gitlab-tags';
import { getSourceUrl as gitlabSourceUrl } from '../gitlab-tags/util';

import type { DataSource } from './types';

// eslint-disable-next-line typescript-enum/no-enum
export enum GoproxyFallback {
  WhenNotFoundOrGone = ',',
  Always = '|',
}

export function getSourceUrl(
  dataSource?: DataSource | null
): string | undefined {
  if (dataSource) {
    const { datasource, registryUrl, packageName } = dataSource;

    if (datasource === GithubTagsDatasource.id) {
      return githubSourceUrl(packageName, registryUrl);
    }

    if (datasource === GitlabTagsDatasource.id) {
      return gitlabSourceUrl(packageName, registryUrl);
    }

    if (datasource === BitBucketTagsDatasource.id) {
      return BitBucketTagsDatasource.getSourceUrl(packageName, registryUrl);
    }
  }

  // istanbul ignore next
  return undefined;
}
