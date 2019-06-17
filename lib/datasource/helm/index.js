const yaml = require('js-yaml');
const got = require('../../util/got');

module.exports = {
  getPkgReleases,
  getRepositoryData,
};

async function getPkgReleases({ lookupName, helmRepository }) {
  if (!lookupName) {
    logger.warn(`lookupName was not provided to getPkgReleases`);
    return null;
  }
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

async function getRepositoryData(repository) {
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
  } catch (gotErr) {
    if (gotErr.statusCode === 404 || gotErr.code === 'ENOTFOUND') {
      logger.warn({ gotErr }, 'index.yaml lookup error');
      return null;
    }
    if (
      gotErr.statusCode === 429 ||
      (gotErr.statusCode > 500 && gotErr.statusCode < 600)
    ) {
      logger.warn({ gotErr }, `${repository} server error`);
      throw new Error('registry-failure');
    }
    logger.warn({ gotErr }, `${repository} lookup failure: Unknown error`);
    return null;
  }
  let result;
  try {
    const doc = yaml.safeLoad(res.body);
    if (!doc) {
      logger.warn(`Failed to parse index.yaml from ${repository}`);
      return null;
    }
    result = {};
    Object.keys(doc.entries).forEach(depName => {
      const versions = doc.entries[depName].map(release => ({
        version: release.version,
      }));
      result[depName] = versions;
    });
    const cacheMinutes = 10;
    await renovateCache.set(cacheNamespace, cacheKey, result, cacheMinutes);
  } catch (yamlErr) {
    return null;
  }
  return result;
}
