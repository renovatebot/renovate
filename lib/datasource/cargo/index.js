const got = require('../../util/got');

module.exports = {
  getPkgReleases,
};

async function getPkgReleases({ lookupName }) {
  if (!lookupName) {
    return null;
  }
  const len = lookupName.length;
  let path;
  if (len === 1) {
    path = '1/' + lookupName;
  } else if (len === 2) {
    path = '2/' + lookupName;
  } else if (len === 3) {
    path = '3/' + lookupName[0] + '/' + lookupName;
  } else {
    path =
      lookupName.slice(0, 2) + '/' + lookupName.slice(2, 4) + '/' + lookupName;
  }
  const baseUrl =
    'https://raw.githubusercontent.com/rust-lang/crates.io-index/master/';
  const crateUrl = baseUrl + path;
  try {
    const res = (await got(crateUrl, {
      json: true,
      platform: 'cargo',
    })).body;
    if (!(res && res.crate && res.crate.name && res.versions)) {
      logger.warn({ dependency: lookupName }, `Received invalid crate data`);
      return null;
    }
    const result = {
      releases: [],
    };
    result.releases = res.versions.map(version => {
      const release = {
        version: version.num,
      };
      if (version.yanked) {
        release.isDeprecated = true;
      }
      return release;
    });
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
