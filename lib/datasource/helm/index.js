const yaml = require('js-yaml');
const got = require('../../util/got');

module.exports = {
  getPkgReleases,
};

async function getPkgReleases({ lookupName, repository }) {
  if (!lookupName) {
    logger.warn(`lookupName was not provided to getPkgReleases`);
    return null;
  }
  if (!repository) {
    logger.warn(`repository was not provided to getPkgReleases`);
    return null;
  }
  try {
    const res = await got('index.yaml', { baseUrl: repository });
    if (!res || !res.body) {
      logger.warn(
        { dependency: lookupName },
        `Received invalid index.yaml from ${repository}`
      );
      return null;
    }
    try {
      const doc = yaml.safeLoad(res.body);
      if (!doc) {
        logger.warn(
          { dependency: lookupName },
          `Failed to parse index.yaml from ${repository}`
        );
        return null;
      }
      let releases = doc.entries[lookupName];
      if (!releases) {
        logger.warn(
          { dependency: lookupName },
          `Entry ${lookupName} doesn't exist in index.yaml from ${repository}`
        );
        return null;
      }
      releases = releases.map(entry => ({
        version: entry.version,
      }));
      return {
        releases,
      };
    } catch (yamlErr) {
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
      logger.warn({ lookupName, gotErr }, `${repository} server error`);
      throw new Error('registry-failure');
    }
    logger.warn(
      { gotErr, lookupName },
      `${repository} lookup failure: Unknown error`
    );
    return null;
  }
}
