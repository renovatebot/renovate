const got = require('got');

module.exports = {
  getDependency,
};

async function getDependency(depName) {
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
        dependency.repository_url = dep.info.home_page;
      } else {
        dependency.homepage = dep.info.home_page;
      }
    }
    dependency.versions = {};
    if (dep.releases) {
      Object.keys(dep.releases).forEach(release => {
        dependency.versions[release] = {
          date: (dep.releases[release][0] || {}).upload_time,
        };
      });
    }
    return dependency;
  } catch (err) {
    logger.info('pypi dependency not found: ' + depName);
    return null;
  }
}
