const got = require('got');
const { isVersion, sortVersions } = require('../versioning/semver');

module.exports = {
  getDependency,
};

async function getDependency(purl) {
  const { fullname: name } = purl;
  logger.trace(`nuget.getDependency(${name})`);
  const pkgUrl = `https://api.nuget.org/v3-flatcontainer/${name.toLowerCase()}/index.json`;
  try {
    const res = (await got(pkgUrl, {
      json: true,
      retries: 5,
    })).body;
    const dep = {
      name,
    };
    dep.releases = res.versions
      .filter(isVersion)
      .sort(sortVersions)
      .map(version => ({ version }));
    logger.trace({ dep }, 'dep');
    return dep;
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.info({ name }, `Dependency lookup failure: not found`);
      logger.debug({
        err,
      });
      return null;
    }
    logger.warn({ err, name }, 'nuget registry failure: Unknown error');
    return null;
  }
}
