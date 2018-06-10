const URL = require('url');
const got = require('got');
const parse = require('github-url-from-git');
const versioning = require('../versioning');

const { isVersion, sortVersions } = versioning('semver');

module.exports = {
  getDependency,
};

async function getDependency(purl) {
  const { fullname: name } = purl;
  logger.trace(`getDependency(${name})`);

  const regUrl = 'https://packagist.org';

  const pkgUrl = URL.resolve(regUrl, `/packages/${name}.json`);

  try {
    const res = (await got(pkgUrl, {
      json: true,
      retries: 5,
    })).body.package;

    // Simplify response before caching and returning
    const dep = {
      name: res.name,
      versions: {},
    };

    if (res.repository) {
      dep.repositoryUrl = parse(res.repository);
    }
    const versions = Object.keys(res.versions)
      .filter(version => isVersion(version))
      .sort(sortVersions);

    dep.releases = versions.map(version => {
      const release = res.versions[version];
      dep.homepage = dep.homepage || release.homepage;
      return {
        version,
        gitHead: version,
        time: release.time,
      };
    });
    dep.homepage = dep.homepage || res.repository;
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
    logger.warn({ err, name }, 'packagist registry failure: Unknown error');
    return null;
  }
}
