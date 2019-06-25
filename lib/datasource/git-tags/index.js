const { getRemoteInfo } = require('isomorphic-git');

const cacheNamespace = 'git-tags';
const cacheMinutes = 10;
const { logger } = require('../../logger');

async function getPkgReleases({ lookupName }) {
  try {
    const cachedResult = await renovateCache.get(cacheNamespace, lookupName);
    /* istanbul ignore next line */
    if (cachedResult) return cachedResult;

    const info = await getRemoteInfo({
      url: lookupName,
    });
    if (info && info.refs && info.refs.tags) {
      const tags = Object.keys(info.refs.tags);
      const result = tags.reduce(
        (accum, gitRef) => {
          if (!/\^/.test(gitRef)) {
            // exclude things like '1.2.3^{}'
            const version = gitRef.replace(/^v(?=[0-9])/, ''); // 'v1.2.3' => '1.2.3'
            accum.releases.push({
              version,
              gitRef,
            });
          }
          return accum;
        },
        {
          sourceUrl: lookupName,
          releases: [],
        }
      );
      await renovateCache.set(cacheNamespace, lookupName, result, cacheMinutes);
      return result;
    }
  } catch (e) {
    logger.debug(`Error looking up for tags in ${lookupName}`);
  }
  return null;
}

module.exports = {
  getPkgReleases,
};
