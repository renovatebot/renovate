const got = require('got');
const url = require('url');
const is = require('@sindresorhus/is');
const { isVersion, sortVersions } = require('../versioning')('pep440');

module.exports = {
  getPkgReleases,
};

function normalizeName(input) {
  return input.toLowerCase().replace(/-/g, '_');
}

async function getPkgReleases(purl, config = {}) {
  const { fullname: depName } = purl;
  let hostUrl = 'https://pypi.org/pypi/';
  if (!is.empty(config.registryUrls)) {
    [hostUrl] = config.registryUrls;
  }
  if (process.env.PIP_INDEX_URL) {
    [hostUrl] = [process.env.PIP_INDEX_URL];
  }
  const lookupUrl = url.resolve(hostUrl, `${depName}/json`);
  try {
    const dependency = {};
    const rep = await got(lookupUrl, {
      json: true,
    });
    const dep = rep && rep.body;
    if (!dep) {
      logger.debug({ depName }, 'pip package not found');
      return null;
    }
    if (
      !(dep.info && normalizeName(dep.info.name) === normalizeName(depName))
    ) {
      logger.warn(
        { lookupUrl, lookupName: depName, returnedName: dep.info.name },
        'Returned name does not match with requested name'
      );
      return null;
    }
    if (dep.info && dep.info.home_page) {
      if (dep.info.home_page.startsWith('https://github.com')) {
        dependency.repositoryUrl = dep.info.home_page;
      } else {
        dependency.homepage = dep.info.home_page;
      }
    }
    dependency.releases = [];
    if (dep.releases) {
      const versions = Object.keys(dep.releases)
        .filter(isVersion)
        .sort(sortVersions);
      dependency.releases = versions.map(version => ({
        version,
        releaseTimestamp: (dep.releases[version][0] || {}).upload_time,
      }));
    }
    return dependency;
  } catch (err) {
    logger.info('pypi dependency not found: ' + depName);
    return null;
  }
}
