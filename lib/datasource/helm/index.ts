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
    if (
      err.statusCode === 429 ||
      (err.statusCode >= 500 && err.statusCode < 600)
    ) {
      throw new DatasourceError(err);
    }
    throw err;
  }
  let doc;
  try {
    doc = yaml.safeLoad(res.body, { json: true });
  } catch (err) {
    logger.debug(err);
  }
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
