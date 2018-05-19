

const URL = require('url');
const got = require('got');
const parse = require('github-url-from-git');
const { isPinnedVersion } = require('../util/semver');

module.exports = {
  getDependency,
}

async function getDependency(name) {

  logger.trace(`getDependency(${name})`);

  const regUrl = 'https://packagist.org';

  const pkgUrl = URL.resolve(
    regUrl,
    `/packages/${name}.json`
  );

  // Retrieve from API if not cached
  try {
    const res = (await got(pkgUrl, {
      json: true,
      retries: 5,
    })).body.package;

    res.homepage = res.repository;

    // Determine repository URL
    let repositoryUrl;

    if (res.repository) {
      repositoryUrl = parse(res.repository.url);
    }

    // Simplify response before caching and returning
    const dep = {
      name: res.name,
      repositoryUrl,
      versions: {},
    };
    Object.keys(res.versions)
      .forEach(version => {
        const pinnedVersion = isPinnedVersion(version);
        if (!pinnedVersion) {
          return;
        }
        const release = res.versions[version];
        dep.homepage = dep.homepage || release.homepage;
        dep.versions[pinnedVersion] = {
          gitHead: version,
          time: release.time,
        };
      });
    dep.homepage = dep.homepage || res.repositoryو
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
