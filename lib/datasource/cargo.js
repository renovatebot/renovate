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
    const res = await got(crateUrl, {
      json: true,
      retry: 5,
    });
    if (!res) {
      logger.info({ dependency: name }, `Failure to receive requested crate`);
      return null;
    }
    if (!res.body || !res.body.crate || !res.body.crate.name) {
      logger.info({ dependency: name }, `Received invalid crate data`);
      return null;
    }
    const body = res.body;
    if (body.crate.name !== name) {
      logger.info(
        { dependency: name },
        `Name of requested crate doesn't match name of received crate: ${
          body.crate.name
        } !== ${name}`
      );
      return null;
    }
    const releases = [];
    for (let i = 0; i < body.versions.length; i += 1) {
      const release = {
        version: body.versions[i].num,
      };
      releases.push(release);
    }
    const result = {
      releases,
    };
    result.repository = body.crate.repository;
    const homepage = body.crate.homepage;
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
    if (
      err.statusCode === 429 ||
      (err.statusCode > 500 && err.statusCode < 600)
    ) {
      logger.warn(
        { dependency: name, err },
        `cargo crates.io registry failure`
      );
      throw new Error('registry-failure');
    }
    logger.warn({ err, name }, 'cargo crates.io lookup failure: Unknown error');
    return null;
  }
}
