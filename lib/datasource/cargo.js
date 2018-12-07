const got = require('got');

module.exports = {
  getPkgReleases,
};

async function getPkgReleases(purl, config) {
  const { fullname: name } = purl;
  logger.trace(`cargo.getPkgReleases(${name})`);
  const baseUrl = 'https://crates.io/api/v1/crates/';
  const crateUrl = baseUrl + name;
  try {
    const res = (await got(crateUrl, {
      json: true,
      retry: 5,
    })).body;
    const max_version = res.body.crate.max_version;
    console.log(max_version);
    const result = {
      releases: [max_version],
    };
    const repository = res.body.crate.repository;
    const homepage = res.body.crate.homepage;
    if (repository) {
      result.repository = repository;
    }
    if(homepage && repository !== homepage) {
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
