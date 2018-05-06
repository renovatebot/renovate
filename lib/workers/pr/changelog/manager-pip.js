
const got = require('got');
const { semverSort, isPinnedVersion } = require('../../../util/semver');

module.exports = {
  getPackage,
};

async function getPackage({ depName }) {
  logger.debug({depName}, 'fetching pip package versions');
  const dep = (await got(`https://pypi.org/pypi/${depName}/json`, {
    json: true,
  })).body;

  if (!dep) {
    logger.debug({depName}, 'pip package not found');
    return null;
  }
  const releases = Object.keys(dep.releases).filter(isPinnedVersion);
  releases.sort(semverSort);
  const versions = releases.map(release => ({
    version: release,
    date: (dep.releases[release][0] || {}).upload_time,
  }));
  const res = {
    repositoryUrl: dep.info.home_page,
    versions,
  };
  logger.debug({res}, 'found pip package versions');
  return res;
}
