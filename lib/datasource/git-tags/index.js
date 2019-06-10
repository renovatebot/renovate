const { getRemoteInfo } = require('isomorphic-git');

const cacheNamespace = 'git-tags';
const cacheMinutes = 10;

async function getPkgReleases({ lookupName, registryUrls = [] }) {
  try {
    for (let idx = 0; idx < registryUrls.length; idx += 1) {
      const registryUrl = registryUrls[idx];
      const cachedResult = await renovateCache.get(cacheNamespace, registryUrl);
      /* istanbul ignore next line */
      if (cachedResult) return cachedResult;

      const url = /\.git$/.test(registryUrl)
        ? registryUrl
        : registryUrl.replace(/\/?$/, '.git');
      const info = await getRemoteInfo({ url });
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
            display: lookupName,
            sourceUrl: registryUrl,
            releases: [],
          }
        );
        await renovateCache.set(
          cacheNamespace,
          registryUrl,
          result,
          cacheMinutes
        );
        return result;
      }
    }
  } catch (e) {
    logger.debug(`Error looking up for tags (${lookupName})`);
  }
  return null;
}

module.exports = {
  getPkgReleases,
};
