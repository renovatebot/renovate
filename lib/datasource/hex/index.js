const got = require('../../util/got');

module.exports = {
  getPkgReleases,
};

async function getPkgReleases(purl) {
  const { lookupName: name } = purl;
  const hexUrl = `https://hex.pm/api/packages/${name}`;
  try {
    const res = (await got(hexUrl, {
      json: true,
    })).body;
    if (!(res && res.releases && res.name)) {
      logger.warn({ dependency: name }, `Received invalid hex package data`);
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
      logger.info({ dependency: name }, `Dependency lookup failure: not found`);
      logger.debug(
        {
          err,
        },
        'Package lookup error'
      );
      return null;
    }
    logger.warn({ err, dependency: name }, 'hex lookup failure: Unknown error');
    return null;
  }
}
