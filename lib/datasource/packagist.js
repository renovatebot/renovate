const URL = require('url');
const got = require('got');
const parse = require('github-url-from-git');
const { isVersion, sortVersions } = require('../versioning')('semverComposer');

module.exports = {
  getPkgReleases,
};

async function packageLookup(regUrl, name) {
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
      .filter(isVersion)
      .sort(sortVersions);

    dep.releases = versions.map(version => {
      const release = res.versions[version];
      dep.homepage = dep.homepage || release.homepage;
      return {
        version: version.replace(/^v/, ''),
        gitRef: version,
        releaseTimestamp: release.time,
      };
    });
    dep.homepage = dep.homepage || res.repository;
    logger.trace({ dep }, 'dep');
    return dep;
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.info({ dependency: name }, `Dependency lookup failure: not found`);
      logger.debug({
        err,
      });
      return null;
    }
    logger.warn({ err, name }, 'packagist registry failure: Unknown error');
    return null;
  }
}

async function getPkgReleases(purl, config = {}) {
  debugger;
  const { fullname: name } = purl;
  logger.trace(`getPkgReleases(${name})`);
  const regUrls = [];
  if (config.registryUrls) {
    for (const regUrl of config.registryUrls) {
      if (regUrl.type === 'composer') {
        regUrls.push(regUrl.url);
      } else {
        logger.info({ regUrl }, 'Unsupported Packagist registry URL');
      }
    }
  }
  regUrls.push('https://packagist.org');
  if (regUrls.length > 1) {
    logger.debug({ regUrls }, 'Packagist registry URLs');
  }
  let res;
  for (const regUrl of regUrls) {
    res = await packageLookup(regUrl, name);
    if (res) {
      break;
    }
  }
  return res;
}
