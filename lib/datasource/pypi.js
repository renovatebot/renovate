const got = require('got');
const { isVersion, sortVersions } = require('../versioning')('pep440');

module.exports = {
  getDependency,
};

async function getDependency(purl) {
  const { fullname: depName } = purl;
  try {
    const dependency = {};
    const rep = await got(`https://pypi.org/pypi/${depName}/json`, {
      json: true,
    });
    const dep = rep && rep.body;
    if (!dep) {
      logger.debug({ depName }, 'pip package not found');
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
