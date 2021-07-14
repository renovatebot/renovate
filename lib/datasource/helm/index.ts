import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { logger } from '../../logger';
import { cache } from '../../util/cache/package/decorator';
import { ensureTrailingSlash } from '../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { HelmRepository, RepositoryData } from './types';

export class HelmDatasource extends Datasource {
  static readonly id = 'helm';

  constructor() {
    super(HelmDatasource.id);
  }

  readonly defaultRegistryUrls = ['https://charts.helm.sh/stable'];

  readonly defaultConfig = {
    commitMessageTopic: 'Helm release {{depName}}',
    group: {
      commitMessageTopic: '{{{groupName}}} Helm releases',
    },
  };

  @cache({
    namespace: `datasource-${HelmDatasource.id}`,
    key: (repository: string) => repository,
  })
  async getRepositoryData(repository: string): Promise<RepositoryData | null> {
    let res: any;
    try {
      res = await this.http.get('index.yaml', {
        baseUrl: ensureTrailingSlash(repository),
      });
      if (!res || !res.body) {
        logger.warn(`Received invalid response from ${repository}`);
        return null;
      }
    } catch (err) {
      this.handleGenericErrors(err);
    }
    try {
      const doc = load(res.body, {
        json: true,
      }) as HelmRepository;
      if (!is.plainObject<HelmRepository>(doc)) {
        logger.warn(`Failed to parse index.yaml from ${repository}`);
        return null;
      }
      const result: RepositoryData = {};
      for (const [name, releases] of Object.entries(doc.entries)) {
        result[name] = {
          homepage: releases[0].home,
          sourceUrl: releases[0].sources ? releases[0].sources[0] : undefined,
          releases: releases.map((release) => ({
            version: release.version,
            releaseTimestamp: release.created ? release.created : null,
          })),
        };
      }

      return result;
    } catch (err) {
      logger.warn(`Failed to parse index.yaml from ${repository}`);
      logger.debug(err);
      return null;
    }
  }

  async getReleases({
    lookupName,
    registryUrl: helmRepository,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const repositoryData = await this.getRepositoryData(helmRepository);
    if (!repositoryData) {
      logger.debug(`Couldn't get index.yaml file from ${helmRepository}`);
      return null;
    }
    const releases = repositoryData[lookupName];
    if (!releases) {
      logger.debug(
        { dependency: lookupName },
        `Entry ${lookupName} doesn't exist in index.yaml from ${helmRepository}`
      );
      return null;
    }
    return releases;
  }
}
