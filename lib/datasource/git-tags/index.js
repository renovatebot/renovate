const { getRemoteInfo } = require('isomorphic-git');

async function getPkgReleases({ lookupName }) {
  try {
    const info = await getRemoteInfo({
      url: lookupName,
    });
    if (info && info.refs && info.refs.tags) {
      const tags = Object.keys(info.refs.tags);
      return tags.reduce(
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
    }
  } catch (e) {
    logger.debug(`Error looking up for tags in ${lookupName}`);
  }
  return null;
}

module.exports = {
  getPkgReleases,
};
