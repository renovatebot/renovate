const got = require('../../util/got');

module.exports = {
  getPkgReleases,
};

function getHostOpts() {
  return {
    json: true,
    platform: 'hex',
  };
}

async function getPkgReleases({ lookupName }) {
  let depName = '';
  if (lookupName) depName = lookupName.split(':')[0];
  const hexUrl = `https://hex.pm/api/packages/${depName}`;
  try {
    const opts = getHostOpts(hexUrl);
    const res = (await got(hexUrl, {
      json: true,
      ...opts,
    })).body;
    if (!(res && res.releases && res.name)) {
      logger.warn({ depName }, `Received invalid hex package data`);
      return null;
    }
    const result = {
      releases: [],
    };
    if (res.releases) {
      result.releases = res.releases.map(version => ({
        version: version.version,
      }));
    }
    if (res.meta && res.meta.links) {
      result.sourceUrl = res.meta.links.Github;
    }
    result.homepage = res.html_url;
    return result;
  } catch (err) {
    if (err.statusCode === 401) {
      logger.info({ depName }, `Authorization failure: not authorized`);
      logger.debug(
        {
          err,
        },
        'Authorization error'
      );
      return null;
    }
    if (err.statusCode === 404) {
      logger.info({ depName }, `Dependency lookup failure: not found`);
      logger.debug(
        {
          err,
        },
        'Package lookup error'
      );
      return null;
    }
    logger.warn({ err, depName }, 'hex lookup failure: Unknown error');
    return null;
  }
}
