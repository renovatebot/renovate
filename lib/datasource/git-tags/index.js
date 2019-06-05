const { getRemoteInfo } = require('isomorphic-git');

async function getPkgReleases({ lookupName }) {
  try {
    const info = await getRemoteInfo({
      url: lookupName,
    });
    if (info && info.refs && info.refs.tags) {
      const tags = Object.keys(info.refs.tags);
      return tags
        .map(tag => tag.replace(/^v(?=[0-9])/, ''))
        .filter(tag => !/\^/.test(tag));
    }
  } catch (e) {
    logger.debug(`Error looking up for tags in ${lookupName}`);
  }
  return null;
}

module.exports = {
  getPkgReleases,
};
