import yaml from 'js-yaml';

import got from '../../util/got';
import { logger } from '../../logger';

export async function getPkgReleases({ lookupName, registryUrls }) {
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
    logger.warn(`Couldn't get index.yaml file from ${helmRepository}`);
    return null;
  }
  const releases = repositoryData[lookupName];
  if (!releases) {
    logger.warn(
      { dependency: lookupName },
      `Entry ${lookupName} doesn't exist in index.yaml from ${helmRepository}`
    );
    return null;
  }
  return {
    releases,
  };
}

export async function getRepositoryData(repository) {
  const cacheNamespace = 'datasource-helm';
  const cacheKey = repository;
  const cachedIndex = await renovateCache.get(cacheNamespace, cacheKey);
  if (cachedIndex) {
    return cachedIndex;
  }
  let res;
  try {
    res = await got('index.yaml', { baseUrl: repository });
    if (!res || !res.body) {
      logger.warn(`Received invalid response from ${repository}`);
      return null;
    }
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.warn({ err }, 'index.yaml lookup error');
      return null;
    }
    if (
      err.statusCode === 429 ||
      (err.statusCode >= 500 && err.statusCode < 600)
    ) {
      logger.warn({ err }, `${repository} server error`);
      throw new Error('registry-failure');
    }
    logger.warn({ err }, `${repository} lookup failure: Unknown error`);
    return null;
  }
  let result;
  try {
    const doc = yaml.safeLoad(res.body, { json: true });
    if (!doc) {
      logger.warn(`Failed to parse index.yaml from ${repository}`);
      return null;
    }
    result = {};
    Object.keys(doc.entries).forEach(depName => {
      const versions = doc.entries[depName].map(release => ({
        version: release.version,
        homepage: release.home,
        sources: release.sources,
        urls: release.urls,
      }));
      result[depName] = versions;
    });
    const cacheMinutes = 20;
    await renovateCache.set(cacheNamespace, cacheKey, result, cacheMinutes);
  } catch (err) {
    logger.warn(`Failed to parse index.yaml from ${repository}`);
    logger.debug(err);
    return null;
  }
  return result;
}
