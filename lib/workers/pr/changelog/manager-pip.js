const got = require('got');
const { sortVersions, isPinnedVersion } = require('../../../versioning/semver');

module.exports = {
  getPackage,
};

async function getPackage({ depName }) {
  try {
    logger.debug({ depName }, 'fetching pip package versions');
    const rep = await got(`https://pypi.org/pypi/${depName}/json`, {
      json: true,
    });

    const dep = rep && rep.body;
    if (!dep) {
      logger.debug({ depName }, 'pip package not found');
      return null;
    }
    const releases = Object.keys(dep.releases).filter(isPinnedVersion);
    releases.sort(sortVersions);
    const versions = releases.map(release => ({
      version: release,
      date: (dep.releases[release][0] || {}).upload_time,
    }));
    const res = {
      repositoryUrl: dep.info.home_page,
      versions,
    };
    logger.debug({ res }, 'found pip package versions');
    return res;
  } catch (err) {
    logger.debug({ err }, 'failed to fetch pip package versions');
    return null;
  }
}
