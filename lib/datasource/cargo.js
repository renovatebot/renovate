const got = require('got');

module.exports = {
  getPkgReleases,
};

async function getPkgReleases(purl) {
  const { fullname: name } = purl;
  logger.trace(`cargo.getPkgReleases(${name})`);
  const baseUrl = 'https://crates.io/api/v1/crates/';
  const crateUrl = baseUrl + name;
  try {
    const res = (await got(crateUrl, {
      json: true,
      retry: 5,
    })).body;
    if (res.crate.name !== name) {
      return null;
    }
    const maxVersion = res.crate.max_version;
    const result = {
      releases: [maxVersion],
    };
    result.repository = res.crate.repository;
    const homepage = res.crate.homepage;
    if (result.repository !== homepage) {
      result.homepage = homepage;
    }
    return result;
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.info({ dependency: name }, `Dependency lookup failure: not found`);
      logger.debug({
        err,
      });
      return null;
    }
    logger.info({ err, name }, 'crates.io lookup failure: Unknown error');
    return null;
  }
}
