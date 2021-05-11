import is from '@sindresorhus/is';
import yaml from 'js-yaml';

import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as packageCache from '../../util/cache/package';
import { Http } from '../../util/http';
import { ensureTrailingSlash } from '../../util/url';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export const id = 'helm';

const http = new Http(id);

export const customRegistrySupport = true;
export const defaultRegistryUrls = ['https://charts.helm.sh/stable'];
export const registryStrategy = 'first';

export const defaultConfig = {
  commitMessageTopic: 'Helm release {{depName}}',
  group: {
    commitMessageTopic: '{{{groupName}}} Helm releases',
  },
};

export type RepositoryData = Record<string, ReleaseResult>;

export async function getRepositoryData(
  repository: string
): Promise<RepositoryData> {
  const cacheNamespace = 'datasource-helm';
  const cacheKey = repository;
  const cachedIndex = await packageCache.get<RepositoryData>(
    cacheNamespace,
    cacheKey
  );
  // istanbul ignore if
  if (cachedIndex) {
    return cachedIndex;
  }
  let res: any;
  try {
    res = await http.get('index.yaml', {
      baseUrl: ensureTrailingSlash(repository),
    });
    if (!res || !res.body) {
      logger.warn(`Received invalid response from ${repository}`);
      return null;
    }
  } catch (err) {
    if (
      err.statusCode === 429 ||
      (err.statusCode >= 500 && err.statusCode < 600)
    ) {
      throw new ExternalHostError(err);
    }
    throw err;
  }
  try {
    interface HelmRepository {
      entries: Record<
        string,
        {
          home?: string;
          sources?: string[];
          version: string;
          created: string;
        }[]
      >;
    }
    const doc: HelmRepository = yaml.safeLoad(res.body, {
      json: true,
    }) as any;
    if (!is.plainObject<Record<string, unknown>>(doc)) {
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
    const cacheMinutes = 20;
    await packageCache.set(cacheNamespace, cacheKey, result, cacheMinutes);
    return result;
  } catch (err) {
    logger.warn(`Failed to parse index.yaml from ${repository}`);
    logger.debug(err);
    return null;
  }
}

export async function getReleases({
  lookupName,
  registryUrl: helmRepository,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const repositoryData = await getRepositoryData(helmRepository);
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
