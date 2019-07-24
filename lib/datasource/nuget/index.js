const urlApi = require('url');
const { logger } = require('../../logger');
const v2 = require('./v2');
const v3 = require('./v3');

module.exports = {
  getPkgReleases,
};

async function getPkgReleases({ lookupName, registryUrls }) {
  logger.trace(`nuget.getPkgReleases(${lookupName})`);
  let dep = null;
  for (const feed of registryUrls || [v3.getDefaultFeed()]) {
    const feedVersion = detectFeedVersion(feed);
    if (feedVersion === 2) {
      dep = await v2.getPkgReleases(feed, lookupName);
    } else if (feedVersion === 3) {
      const queryUrl = await v3.getQueryUrl(feed);
      if (queryUrl !== null) {
        dep = await v3.getPkgReleases(feed, queryUrl, lookupName);
      }
    }
    if (dep != null) {
      break;
    }
  }
  if (dep === null) {
    logger.info(
      { lookupName },
      `Dependency lookup failure: not found in all feeds`
    );
  }
  return dep;
}

function detectFeedVersion(url) {
  try {
    const parsecUrl = urlApi.parse(url);
    // Official client does it in the same way
    if (parsecUrl.pathname.endsWith('.json')) {
      return 3;
    }
    return 2;
  } catch (e) {
    logger.debug({ e }, `nuget registry failure: can't parse ${url}`);
    return null;
  }
}
