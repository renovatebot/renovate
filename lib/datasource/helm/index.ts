import yaml from 'js-yaml';
import { DATASOURCE_FAILURE } from '../../constants/error-messages';

import { PkgReleaseConfig, ReleaseResult } from '../common';
import got from '../../util/got';
import { logger } from '../../logger';

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
    res = await got('index.yaml', { baseUrl: repository });
    if (!res || !res.body) {
      logger.warn(`Received invalid response from ${repository}`);
      return null;
    }
  } catch (err) {
    // istanbul ignore if
    if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
      logger.info({ err }, 'Could not connect to helm repository');
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
      logger.warn({ err }, `${repository} server error`);
      throw new Error(DATASOURCE_FAILURE);
    }
    logger.warn({ err }, `${repository} lookup failure: Unknown error`);
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
}: PkgReleaseConfig): Promise<ReleaseResult | null> {
  if (!lookupName) {
    logger.warn(`lookupName was not provided to getPkgReleases`);
    return null;
  }
  const [helmRepository] = registryUrls;
  if (!helmRepository) {
    logger.warn(`helmRepository was not provided to getPkgReleases`);
    return null;
  }
  const repositoryData = await getRepositoryData(helmRepository);
  if (!repositoryData) {
    logger.info(`Couldn't get index.yaml file from ${helmRepository}`);
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
