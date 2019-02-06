const URL = require('url');

const got = require('../../util/got');
const hostRules = require('../../util/host-rules');

module.exports = {
  getPkgReleases,
};

function getHostOpts(url) {
  const { host } = URL.parse(url);
  const opts = hostRules.find({ platform: 'hex', host }, { json: true });
  if (opts && opts.token) opts.hearders = { Authorization: opts.token };
  return opts;
}

async function getPkgReleases({ lookupName }) {
  const hexUrl = `https://hex.pm/api/packages/${lookupName}`;
  try {
    const opts = getHostOpts(hexUrl);
    const res = (await got(hexUrl, {
      json: true,
      ...opts,
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
    if (res.meta && res.meta.links) {
      result.sourceUrl = res.meta.links.Github;
    }
    result.homepage = res.html_url;
    return result;
  } catch (err) {
    if (err.statusCode === 401) {
      logger.info({ lookupName }, `Authorization failure: not authorized`);
      logger.debug(
        {
          err,
        },
        'Authorization error'
      );
      return null;
    }
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
