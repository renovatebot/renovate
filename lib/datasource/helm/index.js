const yaml = require('js-yaml');
const got = require('../../util/got');

module.exports = {
  getPkgReleases,
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
  const cacheNamespace = 'datasource-helm';
  const cacheKey = helmRepository;
  const cachedIndex = await renovateCache.get(cacheNamespace, cacheKey);
  let res;
  if (!cachedIndex) {
    try {
      res = await got('index.yaml', { baseUrl: helmRepository });
      if (!res || !res.body) {
        logger.warn(
          { dependency: lookupName },
          `Received invalid index.yaml from ${helmRepository}`
        );
        return null;
      }
    } catch (gotErr) {
      if (gotErr.statusCode === 404 || gotErr.code === 'ENOTFOUND') {
        logger.info({ lookupName }, `Dependency lookup failure: not found`);
        logger.debug({ gotErr }, 'index.yaml lookup error');
        return null;
      }
      if (
        gotErr.statusCode === 429 ||
        (gotErr.statusCode > 500 && gotErr.statusCode < 600)
      ) {
        logger.warn({ lookupName, gotErr }, `${helmRepository} server error`);
        throw new Error('registry-failure');
      }
      logger.warn(
        { gotErr, lookupName },
        `${helmRepository} lookup failure: Unknown error`
      );
      return null;
    }
  }
  let doc;
  if (!cachedIndex) {
    try {
      doc = yaml.safeLoad(res.body);
      if (!doc) {
        logger.warn(
          { dependency: lookupName },
          `Failed to parse index.yaml from ${helmRepository}`
        );
        return null;
      }
      const cacheMinutes = 10;
      await renovateCache.set(cacheNamespace, cacheKey, doc, cacheMinutes);
    } catch (yamlErr) {
      return null;
    }
  } else {
    doc = cachedIndex;
  }
  let releases = doc.entries[lookupName];
  if (!releases) {
    logger.warn(
      { dependency: lookupName },
      `Entry ${lookupName} doesn't exist in index.yaml from ${helmRepository}`
    );
    return null;
  }
  releases = releases.map(entry => ({
    version: entry.version,
  }));
  return {
    releases,
  };
}
