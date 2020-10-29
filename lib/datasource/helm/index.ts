import is from '@sindresorhus/is';
import yaml from 'js-yaml';

import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as packageCache from '../../util/cache/package';
import { Http } from '../../util/http';
import { ensureTrailingSlash } from '../../util/url';
import { GetReleasesConfig, ReleaseResult } from '../common';

export const id = 'helm';

const http = new Http(id);

export const defaultRegistryUrls = [
  'https://kubernetes-charts.storage.googleapis.com/',
];
export const registryStrategy = 'first';

export async function getRepositoryData(
  repository: string
): Promise<ReleaseResult[]> {
  const cacheNamespace = 'datasource-helm';
  const cacheKey = repository;
  const cachedIndex = await packageCache.get<ReleaseResult[]>(
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
    const doc = yaml.safeLoad(res.body, { json: true });
    if (!is.plainObject<Record<string, unknown>>(doc)) {
      logger.warn(`Failed to parse index.yaml from ${repository}`);
      return null;
    }
    const result: ReleaseResult[] = Object.entries(doc.entries).map(
      ([k, v]: [string, any]): ReleaseResult => ({
        name: k,
        homepage: v[0].home,
        sourceUrl: v[0].sources ? v[0].sources[0] : undefined,
        releases: v.map((x: any) => ({
          version: x.version,
          releaseTimestamp: x.created ? x.created : null,
        })),
      })
    );
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
  const releases = repositoryData.find((chart) => chart.name === lookupName);
  if (!releases) {
    logger.debug(
      { dependency: lookupName },
      `Entry ${lookupName} doesn't exist in index.yaml from ${helmRepository}`
    );
    return null;
  }
  return releases;
}
