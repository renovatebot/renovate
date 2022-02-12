import { BitBucketTagsDatasource } from '../bitbucket-tags';
import { getSourceUrl as githubSourceUrl } from '../github-releases';
import { id as githubDatasource } from '../github-tags';
import { GitlabTagsDatasource } from '../gitlab-tags';
import { getSourceUrl as gitlabSourceUrl } from '../gitlab-tags/util';

import type { DataSource } from './types';

// eslint-disable-next-line typescript-enum/no-enum
export enum GoproxyFallback {
  WhenNotFoundOrGone = ',',
  Always = '|',
}

export function getSourceUrl(dataSource?: DataSource): string | undefined {
  if (dataSource) {
    const { datasource, registryUrl, lookupName } = dataSource;

    if (datasource === githubDatasource) {
      return githubSourceUrl(lookupName, registryUrl);
    }

    if (datasource === GitlabTagsDatasource.id) {
      return gitlabSourceUrl(lookupName, registryUrl);
    }

    if (datasource === BitBucketTagsDatasource.id) {
      return BitBucketTagsDatasource.getSourceUrl(lookupName, registryUrl);
    }
  }

  // istanbul ignore next
  return undefined;
}
