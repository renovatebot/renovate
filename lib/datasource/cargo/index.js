const got = require('../../util/got');

module.exports = {
  getPkgReleases,
};

async function getPkgReleases({ lookupName }) {
  const crateUrl = `https://crates.io/api/v1/crates/${lookupName}`;
  try {
    const res = (await got(crateUrl, {
      json: true,
    })).body;
    if (!(res && res.crate && res.crate.name)) {
      logger.warn({ lookupName }, `Received invalid crate data`);
      return null;
    }
    const result = {
      releases: [],
    };
    if (res.versions) {
      result.releases = res.versions.map(version => ({
        version: version.num,
      }));
    }
    result.sourceUrl = res.crate.repository;
    result.homepage = res.crate.homepage;
    return result;
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.info({ lookupName }, `Dependency lookup failure: not found`);
      logger.debug(
        {
          err,
        },
        'Crate lookup error'
      );
      return null;
    }
    if (
      err.statusCode === 429 ||
      (err.statusCode > 500 && err.statusCode < 600)
    ) {
      logger.warn({ lookupName, err }, `cargo crates.io registry failure`);
      throw new Error('registry-failure');
    }
    logger.warn(
      { err, lookupName },
      'cargo crates.io lookup failure: Unknown error'
    );
    return null;
  }
}
