import yaml from 'js-yaml';

import { DatasourceError, GetReleasesConfig, ReleaseResult } from '../common';
import got from '../../util/got';
import { logger } from '../../logger';

export const id = 'helm';

export async function getRepositoryData(
  repository: string
): Promise<ReleaseResult[]> {
  const cacheNamespace = 'datasource-helm';
  const cacheKey = repository;
  const cachedIndex = await renovateCache.get(cacheNamespace, cacheKey);
  if (cachedIndex) {
    return cachedIndex;
  }
  let res: any;
  try {
    res = await got('index.yaml', { hostType: id, baseUrl: repository });
    if (!res || !res.body) {
      logger.warn(`Received invalid response from ${repository}`);
      return null;
    }
  } catch (err) {
    // istanbul ignore if
    if (err.code === 'ERR_INVALID_URL') {
      logger.debug(
        { helmRepository: repository },
        'helm repository is not a valid URL - skipping'
      );
      return null;
    }
    // istanbul ignore if
    if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
      logger.debug({ err }, 'Could not connect to helm repository');
      return null;
    }
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.warn({ err }, 'index.yaml lookup error');
      return null;
    }
    if (
      err.statusCode === 429 ||
      (err.statusCode >= 500 && err.statusCode < 600)
    ) {
      throw new DatasourceError(err);
    }
    // istanbul ignore if
    if (err.name === 'UnsupportedProtocolError') {
      logger.debug({ repository }, 'Unsupported protocol');
      return null;
    }
    logger.warn(
      { err },
      `helm datasource ${repository} lookup failure: Unknown error`
    );
    return null;
  }
  try {
    const doc = yaml.safeLoad(res.body, { json: true });
    if (!doc) {
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
    await renovateCache.set(cacheNamespace, cacheKey, result, cacheMinutes);
    return result;
  } catch (err) {
    logger.warn(`Failed to parse index.yaml from ${repository}`);
    logger.debug(err);
    return null;
  }
}

export async function getPkgReleases({
  lookupName,
  registryUrls,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const [helmRepository] = registryUrls;
  if (!helmRepository) {
    logger.warn(`helmRepository was not provided to getPkgReleases`);
    return null;
  }
  const repositoryData = await getRepositoryData(helmRepository);
  if (!repositoryData) {
    logger.debug(`Couldn't get index.yaml file from ${helmRepository}`);
    return null;
  }
  const releases = repositoryData.find(chart => chart.name === lookupName);
  if (!releases) {
    logger.warn(
      { dependency: lookupName },
      `Entry ${lookupName} doesn't exist in index.yaml from ${helmRepository}`
    );
    return null;
  }
  return releases;
}
