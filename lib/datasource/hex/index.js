const got = require('../../util/got');

module.exports = {
  getPkgReleases,
};

async function getPkgReleases({ lookupName }) {
  const hexUrl = `https://hex.pm/api/packages/${lookupName}`;
  try {
    const res = (await got(hexUrl, {
      json: true,
    })).body;
    if (!(res && res.releases && res.name)) {
      logger.warn({ lookupName }, `Received invalid hex package data`);
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
    result.sourceUrl = res.html_url;
    result.homepage = res.html_url;
    return result;
  } catch (err) {
    if (err.statusCode === 404) {
      logger.info({ lookupName }, `Dependency lookup failure: not found`);
      logger.debug(
        {
          err,
        },
        'Package lookup error'
      );
      return null;
    }
    logger.warn({ err, lookupName }, 'hex lookup failure: Unknown error');
    return null;
  }
}
