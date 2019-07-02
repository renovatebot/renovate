const { getRemoteInfo } = require('isomorphic-git');
const hostRules = require('../../util/host-rules');

const cacheNamespace = 'git-tags';
const cacheMinutes = 10;

async function getPkgReleases({ lookupName }) {
  // transform to https because isomorphic-git doesn't support ssh yet
  // discuss: use native git?
  const lookupNameHttps = lookupName.replace(
    /^git@(.+?):(.+)/,
    'https://$1/$2'
  );
  if (lookupName !== lookupNameHttps) {
    logger.info(`git lookup: Transformed ${lookupName} to ${lookupNameHttps}`);
  }
  try {
    const cachedResult = await renovateCache.get(
      cacheNamespace,
      lookupNameHttps
    );
    /* istanbul ignore next line */
    if (cachedResult) return cachedResult;

    const { username, password, token } = hostRules.find({
      hostType: 'git',
      url: lookupNameHttps,
    });
    const info = await getRemoteInfo({
      url: lookupNameHttps,
      username,
      password,
      token,
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
          sourceUrl: lookupNameHttps,
          releases: [],
        }
      );
      await renovateCache.set(
        cacheNamespace,
        lookupNameHttps,
        result,
        cacheMinutes
      );
      return result;
    }
  } catch (e) {
    logger.debug(`Error looking up tags in ${lookupNameHttps}`);
  }
  return null;
}

module.exports = {
  getPkgReleases,
};
